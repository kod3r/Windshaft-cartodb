var _ = require('underscore')
    , Step       = require('step')
    , Windshaft = require('windshaft')
    , TemplateMaps = require('./template_maps.js')
    , Cache = require('./cache_validator')
    , os = require('os')
    , HealthCheck = require('./monitoring/health_check')
;

if ( ! process.env['PGAPPNAME'] )
  process.env['PGAPPNAME']='cartodb_tiler';

var CartodbWindshaft = function(serverOptions) {
    // Perform keyword substitution in statsd
    // See https://github.com/CartoDB/Windshaft-cartodb/issues/153
    if ( global.environment.statsd ) {
      if ( global.environment.statsd.prefix ) {
        var host_token = os.hostname().split('.').reverse().join('.');
        global.environment.statsd.prefix = global.environment.statsd.prefix.replace(/:host/, host_token);
      }
    }

    var redisPool = serverOptions.redis.pool
        || require('redis-mpool')(_.extend(global.environment.redis, {name: 'windshaft:cartodb'}));

    var cartoData = require('cartodb-redis')({pool: redisPool});

    if(serverOptions.cache_enabled) {
        console.log("cache invalidation enabled, varnish on ", serverOptions.varnish_host, ' ', serverOptions.varnish_port);
        Cache.init(serverOptions.varnish_host, serverOptions.varnish_port, serverOptions.varnish_secret);
        serverOptions.afterStateChange = function(req, data, callback) {
            Cache.invalidate_db(req.params.dbname, req.params.table);
            callback(null, data);
        }
    }

    serverOptions.beforeStateChange = function(req, callback) {
        var err = null;
        if ( ! req.params.hasOwnProperty('_authorizedByApiKey') ) {
          err = new Error("map state cannot be changed by unauthenticated request!");
        }
        callback(err, req);
    };

    // This is for Templated maps
    //
    // "named" is the official, "template" is for backward compatibility up to 1.6.x
    //
    var template_baseurl = global.environment.base_url_templated || '(?:/maps/named|/tiles/template)';

    var templateMapsOpts = {
      max_user_templates: global.environment.maxUserTemplates
    };
    var templateMaps = new TemplateMaps(redisPool, templateMapsOpts);
    serverOptions.templateMaps = templateMaps;

    var SurrogateKeysCache = require('./cache/surrogate_keys_cache'),
        NamedMapsCacheEntry = require('./cache/model/named_maps_entry'),
        VarnishHttpCacheBackend = require('./cache/backend/varnish_http'),
        varnishHttpCacheBackend = new VarnishHttpCacheBackend(serverOptions.varnish_host, serverOptions.varnish_http_port),
        surrogateKeysCache = new SurrogateKeysCache(varnishHttpCacheBackend);

    if (serverOptions.varnish_purge_enabled) {
        function invalidateNamedMap(owner, templateName) {
            surrogateKeysCache.invalidate(new NamedMapsCacheEntry(owner, templateName), function(err) {
                if (err) {
                    console.warn('Cache: surrogate key invalidation failed');
                }
            });
        }

        ['update', 'delete'].forEach(function(eventType) {
            templateMaps.on(eventType, invalidateNamedMap);
        });
    }

    // boot
    var ws = new Windshaft.Server(serverOptions);

    // Override getVersion to include cartodb-specific versions
    var wsversion = ws.getVersion;
    ws.getVersion = function() {
      var version = wsversion();
      version.windshaft_cartodb = require('../../package.json').version;
      return version;
    };

    var ws_sendResponse = ws.sendResponse;
    // GET routes for which we don't want to request any caching.
    // POST/PUT/DELETE requests are never cached anyway.
    var noCacheGETRoutes = [
      '/',
      // See https://github.com/CartoDB/Windshaft-cartodb/issues/176
      serverOptions.base_url_mapconfig,
      template_baseurl + '/:template_id/jsonp'
    ];
    ws.sendResponse = function(res, args) {
      var that = this;
      var thatArgs = arguments;
      var statusCode;
      if ( res._windshaftStatusCode ) {
        // Added by our override of sendError
        statusCode = res._windshaftStatusCode;
      } else {
        if ( args.length > 2 ) statusCode = args[2];
        else {
          statusCode = args[1] || 200;
        }
      }
      var req = res.req;
      Step (
        function addCacheChannel() {
          if ( ! req ) {
            // having no associated request can happen when
            // using fake response objects for testing layergroup
            // creation
            return false;
          }
          if ( ! req.params ) {
            // service requests (/version, /) 
            // have no need for an X-Cache-Channel
            return false;
          }
          if ( statusCode != 200 ) {
            // We do not want to cache
            // unsuccessful responses
            return false;
          }
          if ( _.contains(noCacheGETRoutes, req.route.path) ) {
//console.log("Skipping cache channel in route:\n" + req.route.path);
            return false;
          }
//console.log("Adding cache channel to route\n" + req.route.path + " not matching any in:\n" + mapCreateRoutes.join("\n"));
          serverOptions.addCacheChannel(that, req, this);
        },
        function sendResponse(err, added) {
          if ( err ) console.log(err + err.stack);
          ws_sendResponse.apply(that, thatArgs);
          return null;
        },
        function finish(err) {
          if ( err ) console.log(err + err.stack);
        }
      );
    };

    var ws_sendError = ws.sendError;
    ws.sendError = function() {
      var res = arguments[0];
      var statusCode = arguments[2];
      res._windshaftStatusCode = statusCode;
      ws_sendError.apply(this, arguments);
    };

    /*******************************************************************************************************************
     * Routing
     ******************************************************************************************************************/

    var TemplateMapsController = require('./controllers/template_maps'),
        templateMapsController = new TemplateMapsController(
            ws, serverOptions, templateMaps, cartoData, template_baseurl, surrogateKeysCache, NamedMapsCacheEntry
        );
    templateMapsController.register(ws);

    /*******************************************************************************************************************
     * END Routing
     ******************************************************************************************************************/

    /**
     * Helper to allow access to the layer to be used in the maps infowindow popup.
     */
    ws.get(serverOptions.base_url + '/infowindow', function(req, res){
        ws.doCORS(res);
        Step(
            function(){
                serverOptions.getInfowindow(req, this);
            },
            function(err, data){
                if (err){
                    ws.sendError(res, {error: err.message}, 500, 'GET INFOWINDOW', err);
                    //ws.sendResponse(res, [{error: err.message}, 500]);
                } else {
                    ws.sendResponse(res, [{infowindow: data}, 200]);
                }
            }
        );
    });


    /**
     * Helper to allow access to metadata to be used in embedded maps.
     */
    ws.get(serverOptions.base_url + '/map_metadata', function(req, res){
        ws.doCORS(res);
        Step(
            function(){
                serverOptions.getMapMetadata(req, this);
            },
            function(err, data){
                if (err){
                    ws.sendError(res, {error: err.message}, 500, 'GET MAP_METADATA', err);
                    //ws.sendResponse(res, [err.message, 500]);
                } else {
                    ws.sendResponse(res, [{map_metadata: data}, 200]);
                }
            }
        );
    });

    /**
     * Helper API to allow per table tile cache (and sql cache) to be invalidated remotely.
     * TODO: Move?
     */
    ws.del(serverOptions.base_url + '/flush_cache', function(req, res){
        if ( req.profiler && req.profiler.statsd_client ) {
          req.profiler.start('windshaft-cartodb.flush_cache');
        }
        ws.doCORS(res);
        Step(
            function flushCache(){
                serverOptions.flushCache(req, serverOptions.cache_enabled ? Cache : null, this);
            },
            function sendResponse(err, data){
                if (err){
                    ws.sendError(res, {error: err.message}, 500, 'DELETE CACHE', err);
                    //ws.sendResponse(res, [500]);
                } else {
                    ws.sendResponse(res, [{status: 'ok'}, 200]);
                }
            }
        );
    });

    var healthCheck = new HealthCheck(cartoData, Windshaft.tilelive);
    ws.get('/health', function(req, res) {
        var healthConfig = global.environment.health || {};

        if (!!healthConfig.enabled) {
            var startTime = Date.now();
            healthCheck.check(healthConfig, function(err, result) {
                var ok = !err;
                var response = {
                    enabled: true,
                    ok: ok,
                    elapsed: Date.now() - startTime,
                    result: result
                };
                if (err) {
                    response.err = err.message;
                }
                res.send(response, ok ? 200 : 503);

            });
        } else {
            res.send({enabled: false, ok: true}, 200);
        }
    });

    return ws;
};

module.exports = CartodbWindshaft;
