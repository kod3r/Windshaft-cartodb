var assert = require('assert')
  //, _ = require('underscore')
  , RedisPool = require('redis-mpool')
  , TemplateMaps = require('../../../lib/cartodb/template_maps.js')
  , test_helper = require('../../support/test_helper')
  , Step = require('step')
  , _ = require('underscore')
  , tests = module.exports = {};

suite('template_maps', function() {

  // configure redis pool instance to use in tests
  var redis_pool = RedisPool(global.environment.redis);

    var wadusLayer = {
        options: {
            sql: 'select 1 cartodb_id, null::geometry the_geom_webmercator',
            cartocss: '#layer { marker-fill:blue; }',
            cartocss_version: '2.3.0'
        }
    };

    var validTemplate = {
        version:'0.0.1',
        name: 'first',
        auth: {},
        layergroup: {
            layers: [
                wadusLayer
            ]
        }
    };
    var owner = 'me';
    
  test('does not accept template with unsupported version', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'6.6.6',
      name:'k', auth: {}, layergroup: {layers:[wadusLayer]} };
    Step(
      function() {
        tmap.addTemplate('me', tpl, this);
      },
      function checkFailed(err) {
        assert.ok(err);
        assert.ok(err.message.match(/unsupported.*version/i), err);
        return null;
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('does not accept template with missing name', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      auth: {}, layergroup: {layers:[wadusLayer]} };
    Step(
      function() {
        tmap.addTemplate('me', tpl, this);
      },
      function checkFailed(err) {
        assert.ok(err);
        assert.ok(err.message.match(/missing.*name/i), err);
        return null;
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('does not accept template with invalid name', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      auth: {}, layergroup: {layers:[wadusLayer]} };
    var invalidnames = [ "ab|", "a b", "a@b", "1ab", "_x", "", " x", "x " ];
    var testNext = function() {
      if ( ! invalidnames.length ) { done(); return; }
      var n = invalidnames.pop();
      tpl.name = n;
      tmap.addTemplate('me', tpl, function(err) {
        if ( ! err ) {
          done(new Error("Unexpected success with invalid name '" + n + "'"));
        }
        else if ( ! err.message.match(/template.*name/i) ) {
          done(new Error("Unexpected error message with invalid name '" + n
            + "': " + err));
        }
        else {
          testNext();
        }
      });
    };
    testNext();
  });

  test('does not accept template with invalid placeholder name', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      name: "valid", placeholders: {},
      auth: {}, layergroup: {layers:[wadusLayer]} };
    var invalidnames = [ "ab|", "a b", "a@b", "1ab", "_x", "", " x", "x " ];
    var testNext = function() {
      if ( ! invalidnames.length ) { done(); return; }
      var n = invalidnames.pop();
      tpl.placeholders = {};
      tpl.placeholders[n] = { type:'number', default:1 };
      tmap.addTemplate('me', tpl, function(err) {
        if ( ! err ) {
          done(new Error("Unexpected success with invalid name '" + n + "'"));
        }
        else if ( ! err.message.match(/invalid.*name/i) ) {
          done(new Error("Unexpected error message with invalid name '" + n
            + "': " + err));
        }
        else {
          testNext();
        }
      });
    };
    testNext();
  });

  test('does not accept template with missing placeholder default', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      name: "valid", placeholders: { v: {} },
      auth: {}, layergroup: {layers:[wadusLayer]} };
    tmap.addTemplate('me', tpl, function(err) {
        if ( ! err ) {
          done(new Error("Unexpected success with missing placeholder default"));
        }
        else if ( ! err.message.match(/missing default/i) ) {
          done(new Error("Unexpected error message with missing placeholder default: "
            + err));
        }
        else {
          done();
        }
      });
  });

  test('does not accept template with missing placeholder type', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      name: "valid", placeholders: { v: { default:1 } },
      auth: {}, layergroup: {layers:[wadusLayer]} };
    tmap.addTemplate('me', tpl, function(err) {
        if ( ! err ) {
          done(new Error("Unexpected success with missing placeholder type"));
        }
        else if ( ! err.message.match(/missing type/i) ) {
          done(new Error("Unexpected error message with missing placeholder default: "
            + err));
        }
        else {
          done();
        }
      });
  });

  // See http://github.com/CartoDB/Windshaft-cartodb/issues/128
  test('does not accept template with invalid token auth (undefined tokens)',
  function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var tpl = { version:'0.0.1',
      name: "invalid_auth1", placeholders: { },
      auth: { method: 'token' }, layergroup: {layers:[wadusLayer]} };
    tmap.addTemplate('me', tpl, function(err) {
        if ( ! err ) {
          done(new Error("Unexpected success with invalid token auth (undefined tokens)"));
        }
        else if ( ! err.message.match(/invalid 'token' authentication/i) ) {
          done(new Error("Unexpected error message with invalid token auth (undefined tokens): "
            + err));
        }
        else {
          done();
        }
      });
  });

  test('add, get and delete a valid template', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var expected_failure = false;
    var tpl_id;
    var tpl = { version:'0.0.1',
      name: 'first', auth: {}, layergroup: {layers:[wadusLayer]} };
    Step(
      function() {
        tmap.addTemplate('me', tpl, this);
      },
      function addOmonimousTemplate(err, id) {
        if ( err ) throw err;
        tpl_id = id;
        assert.equal(tpl_id, 'first');
        expected_failure = true;
        // should fail, as it already exists
        tmap.addTemplate('me', tpl, this);
      },
      function getTemplate(err) {
        if ( ! expected_failure && err ) throw err;
        assert.ok(err);
        assert.ok(err.message.match(/already exists/i), err);
        tmap.getTemplate('me', tpl_id, this);
      },
      function delTemplate(err, got_tpl) {
        if ( err ) throw err;
        assert.deepEqual(got_tpl, _.extend({}, tpl, {auth: {method: 'open'}, placeholders: {}}));
        tmap.delTemplate('me', tpl_id, this);
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('add multiple templates, list them', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var expected_failure = false;
    var tpl1 = { version:'0.0.1', name: 'first', auth: {}, layergroup: {layers:[wadusLayer]} };
    var tpl1_id;
    var tpl2 = { version:'0.0.1', name: 'second', auth: {}, layergroup: {layers:[wadusLayer]} };
    var tpl2_id;
    Step(
      function addTemplate1() {
        tmap.addTemplate('me', tpl1, this);
      },
      function addTemplate2(err, id) {
        if ( err ) throw err;
        tpl1_id = id;
        tmap.addTemplate('me', tpl2, this);
      },
      function listTemplates(err, id) {
        if ( err ) throw err;
        tpl2_id = id;
        tmap.listTemplates('me', this);
      },
      function checkTemplates(err, ids) {
        if ( err ) throw err;
        assert.equal(ids.length, 2);
        assert.ok(ids.indexOf(tpl1_id) != -1, ids.join(','));
        assert.ok(ids.indexOf(tpl2_id) != -1, ids.join(','));
        return null;
      },
      function delTemplate1(err) {
        if ( tpl1_id ) {
          var next = this;
          tmap.delTemplate('me', tpl1_id, function(e) {
            if ( err || e ) next(new Error(err + '; ' + e));
            else next();
          });
        } else {
          if ( err ) throw err;
          return null;
        }
      },
      function delTemplate2(err) {
        if ( tpl2_id ) {
          var next = this;
          tmap.delTemplate('me', tpl2_id, function(e) {
            if ( err || e ) next(new Error(err + '; ' + e));
            else next();
          });
        } else {
          if ( err ) throw err;
          return null;
        }
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('update templates', function(done) {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);
    var expected_failure = false;
    var owner = 'me';
    var tpl = { version:'0.0.1',
      name: 'first',
      auth: { method: 'open' },
      layergroup: {layers:[wadusLayer]}
    };
    var tpl_id;
    Step(
      function addTemplate() {
        tmap.addTemplate(owner, tpl, this);
      },
      // Updating template name should fail
      function updateTemplateName(err, id) {
        if ( err ) throw err;
        tpl_id = id;
        expected_failure = true;
        tpl.name = 'second';
        tmap.updTemplate(owner, tpl_id, tpl, this);
      },
      function updateTemplateAuth(err) {
        if ( err && ! expected_failure) throw err;
        expected_failure = false;
        assert.ok(err);
        tpl.name = 'first';
        tpl.auth.method = 'token';
        tpl.auth.valid_tokens = [ 'tok1' ];
        tmap.updTemplate(owner, tpl_id, tpl, this);
      },
      function updateTemplateWithInvalid(err) {
        if ( err ) throw err;
        tpl.version = '999.999.999';
        expected_failure = true;
        tmap.updTemplate(owner, tpl_id, tpl, this);
      },
      function updateUnexistentTemplate(err) {
        if ( err && ! expected_failure) throw err;
        expected_failure = false;
        assert.ok(err);
        assert.ok(err.message.match(/unsupported.*version/i), err);
        tpl.version = '0.0.1';
        expected_failure = true;
        tmap.updTemplate(owner, 'unexistent', tpl, this);
      },
      function delTemplate(err) {
        if ( err && ! expected_failure) throw err;
        expected_failure = false;
        assert.ok(err);
        assert.ok(err.message.match(/cannot update name/i), err);
        tmap.delTemplate(owner, tpl_id, this);
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('instanciate templates', function() {
    var tmap = new TemplateMaps(redis_pool);
    assert.ok(tmap);

    var tpl1 =  {
        version: '0.0.1',
        name: 'acceptance1',
        auth: { method: 'open' },
        placeholders: {
          fill: { type: "css_color", default: "red" },
          color: { type: "css_color", default: "#a0fF9A" },
          name: { type: "sql_literal", default: "test" },
          zoom: { type: "number", default: "0" },
          test_number: { type: "number", default: 23 },
        },
        layergroup: {
          version: '1.0.0',
          global_cartocss_version: '2.0.2',
          layers: [
             { options: {
                 sql: "select '<%=name %>' || id, g from t",
                 cartocss: '#layer { marker-fill:<%= fill %>; marker-width: <%=test_number  %>; }'
               } },
             { options: {
                 sql: "select fun('<%=     name%>') g from x",
                 cartocss: '#layer { line-color:<%= color %>; marker-fill:<%= color %>; }'
               } },
             { options: {
                 sql: "select g from x",
                 cartocss: '#layer[zoom=<%=zoom%>] { }'
               } }
          ]
        }
    };

    var inst = tmap.instance(tpl1, {});

    var lyr = inst.layers[0].options;
    assert.equal(lyr.sql, "select 'test' || id, g from t");
    assert.equal(lyr.cartocss, '#layer { marker-fill:red; marker-width: 23; }');

    lyr = inst.layers[1].options;
    assert.equal(lyr.sql, "select fun('test') g from x");
    assert.equal(lyr.cartocss, '#layer { line-color:#a0fF9A; marker-fill:#a0fF9A; }');

    inst = tmap.instance(tpl1, {color:'yellow', name:"it's dangerous"});

    lyr = inst.layers[0].options;
    assert.equal(lyr.sql, "select 'it''s dangerous' || id, g from t");
    assert.equal(lyr.cartocss, '#layer { marker-fill:red; marker-width: 23; }');

    lyr = inst.layers[1].options;
    assert.equal(lyr.sql, "select fun('it''s dangerous') g from x");
    assert.equal(lyr.cartocss, '#layer { line-color:yellow; marker-fill:yellow; }');

    // Invalid css_color
    var err = null;
    try { inst = tmap.instance(tpl1, {color:'##ff00ff'}); }
    catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.message.match(/invalid css_color/i), err);

    // Invalid css_color 2 (too few digits)
    var err = null;
    try { inst = tmap.instance(tpl1, {color:'#ff'}); }
    catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.message.match(/invalid css_color/i), err);

    // Invalid css_color 3 (too many digits)
    var err = null;
    try { inst = tmap.instance(tpl1, {color:'#1234567'}); }
    catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.message.match(/invalid css_color/i), err);

    // Invalid number
    var err = null;
    try { inst = tmap.instance(tpl1, {zoom:'#'}); }
    catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.message.match(/invalid number/i), err);

    // Invalid number 2
    var err = null;
    try { inst = tmap.instance(tpl1, {zoom:'23e'}); }
    catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.message.match(/invalid number/i), err);

    // Valid number
    var err = null;
    try { inst = tmap.instance(tpl1, {zoom:'-.23e10'}); }
    catch (e) { err = e; }
    assert.ok(!err);
  });

  // Can set a limit on the number of user templates
  test('can limit number of user templates', function(done) {
    var tmap = new TemplateMaps(redis_pool, {
      max_user_templates: 2
    });
    assert.ok(tmap);
    var tpl = { version:'0.0.1', auth: {}, layergroup: {layers:[wadusLayer]} };
    var expectErr = false;
    var idMe = [];
    var idYou = [];
    Step(
      function oneForMe() {
        tpl.name = 'oneForMe';
        tmap.addTemplate('me', tpl, this);
      },
      function twoForMe(err, id) {
        if ( err ) throw err;
        assert.ok(id);
        idMe.push(id);
        tpl.name = 'twoForMe';
        tmap.addTemplate('me', tpl, this);
      },
      function threeForMe(err, id) {
        if ( err ) throw err;
        assert.ok(id);
        idMe.push(id);
        tpl.name = 'threeForMe';
        expectErr = true;
        tmap.addTemplate('me', tpl, this);
      },
      function errForMe(err, id) {
        if ( err && ! expectErr ) throw err;
        expectErr = false;
        assert.ok(err);
        assert.ok(err.message.match(/limit.*template/), err);
        return null;
      },
      function delOneMe(err) {
        if ( err ) throw err;
        tmap.delTemplate('me', idMe.shift(), this);
      },
      function threeForMeRetry(err) {
        if ( err ) throw err;
        tpl.name = 'threeForMe';
        tmap.addTemplate('me', tpl, this);
      },
      function oneForYou(err, id) {
        if ( err ) throw err;
        assert.ok(id);
        idMe.push(id);
        tpl.name = 'oneForYou';
        tmap.addTemplate('you', tpl, this);
      },
      function twoForYou(err, id) {
        if ( err ) throw err;
        assert.ok(id);
        idYou.push(id);
        tpl.name = 'twoForYou';
        tmap.addTemplate('you', tpl, this);
      },
      function threeForYou(err, id) {
        if ( err ) throw err;
        assert.ok(id);
        idYou.push(id);
        tpl.name = 'threeForYou';
        expectErr = true;
        tmap.addTemplate('you', tpl, this);
      },
      function errForYou(err, id) {
        if ( err && ! expectErr ) throw err;
        expectErr = false;
        assert.ok(err);
        assert.ok(err.message.match(/limit.*template/), err);
        return null;
      },
      function finish(err) {
        // TODO: delete all templates
        done(err);
      }
    );
  });

});
