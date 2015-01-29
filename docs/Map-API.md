## Maps API

The CartoDB Maps API allows you to generate maps based on data hosted in your CartoDB account, and you can apply custom SQL and CartoCSS to the data. The API generates a XYZ-based URL to fetch Web Mercator projected tiles using web clients such as [Leaflet](http://leafletjs.com), [Google Maps](https://developers.google.com/maps/), or [OpenLayers](http://openlayers.org/).

You can create two types of maps with the Maps API:

- **Anonymous maps**  
  Maps that can be created using your CartoDB public data. Any client can change the read-only SQL and CartoCSS parameters that generate the map tiles. These maps can be created from a JavaScript application alone and no authenticated calls are needed. See [this CartoDB.js example]({{ '/cartodb-platform/cartodb-js.html' | prepend: site.baseurl }}).

- **Named maps**  
  Maps that have access to your private data. These maps require an owner to setup and modify any SQL and CartoCSS parameters and are not modifiable without new setup calls. 

## Quickstart

### Anonymous maps

Here is an example of how to create an anonymous map with JavaScript:

```javascript
var mapconfig = {
  "version": "1.0.1",
  "layers": [{
    "type": "cartodb",
    "options": {
      "cartocss_version": "2.1.1",
      "cartocss": "#layer { polygon-fill: #FFF; }",
      "sql": "select * from european_countries_e"
    }
  }]
}

$.ajax({
  crossOrigin: true,
  type: 'POST',
  dataType: 'json',
  contentType: 'application/json',
  url: 'http://documentation.cartodb.com/api/v1/map',
  data: JSON.stringify(mapconfig),
  success: function(data) {
    var templateUrl = 'http://documentation.cartodb.com/api/v1/map/' + data.layergroupid + '/{z}/{x}/{y}.png'
    console.log(templateUrl);
  }
})
```

### Named maps

Let's create a named map using some private tables in a CartoDB account.
The following map config sets up a map of European countries that have a white fill color:

```javascript
{
  "version": "0.0.1",
  "name": "test",
  "auth": {
    "method": "open"
  },
  "layergroup": {
    "layers": [{
      "type": "cartodb",
      "options": {
        "cartocss_version": "2.1.1",
        "cartocss": "#layer { polygon-fill: #FFF; }",
        "sql": "select * from european_countries_e"
      }
    }]
  }
}
```

The map config needs to be sent to CartoDB's Map API using an authenticated call. Here we will use a command line tool called `curl`. For more info about this tool, see [this blog post](http://quickleft.com/blog/command-line-tutorials-curl), or type ``man curl`` in bash. Using `curl`, and storing the config from above in a file `mapconfig.json`, the call would look like:

<div class="code-title notitle code-request"></div>
```bash
curl 'https://{account}.cartodb.com/api/v1/map/named?api_key=APIKEY' -H 'Content-Type: application/json' -d @mapconfig.json
```

To get the `URL` to fetch the tiles you need to instantiate the map, where `template_id` is the template name from the previous response.

<div class="code-title notitle code-request"></div>
```bash
curl -X POST 'http://{account}.cartodb.com/api/v1/map/named/:template_id' -H 'Content-Type: application/json'
```

The response will return JSON with properties for the `layergroupid`, `cdn_url`, and the timestamp (`last_updated`) of the last data modification. 

Here is an example response:

```javascript
{
  "cdn_url": {
    "http": "ashbu.cartocdn.com",
    "https": "cartocdn-ashbu.global.ssl.fastly.net"
  },
  "layergroupid": "c01a54877c62831bb51720263f91fb33:0",
  "last_updated": "1970-01-01T00:00:00.000Z"
}
```

You can use the `layergroupid` to instantiate a URL template for accessing tiles on the client. Here we use the `layergroupid` from the example response above in this URL template:

```bash
http://documentation.cartodb.com/api/v1/map/c01a54877c62831bb51720263f91fb33:0/{z}/{x}/{y}.png
```

## General Concepts

The following concepts are the same for every endpoint in the API except when it's noted explicitly.

### Auth

By default, users do not have access to private tables in CartoDB. In order to instantiate a map from private table data, an API Key is required. Additionally, to include some endpoints, an API Key must be included (e.g. creating a named map).

To execute an authorized request, api_key=YOURAPIKEY should be added to the request URL. The param can be also passed as POST param. We **strongly advise** using HTTPS when you are performing requests that include your `api_key`.

### Errors

Errors are reported using standard HTTP codes and extended information encoded in JSON with this format:

```javascript
{
  "errors": [
    "access forbidden to table TABLE"
  ]
}
```

If you use JSONP, the 200 HTTP code is always returned so the JavaScript client can receive errors from the JSON object.

### CORS support

All the endpoints which might be accessed using a web browser add CORS headers and allow OPTIONS method.

## Anonymous Maps

Anonymous maps allows you to instantiate a map given SQL and CartoCSS. It also allows you to add interaction capabilities using [UTF Grid.](https://github.com/mapbox/utfgrid-spec)

### Instantiate

#### Definition

<div class="code-title notitle code-request"></div>
```html
POST /api/v1/map
```

#### Params

```javascript
{
  "version": "1.0.1",
  "layers": [{
    "type": "cartodb",
    "options": {
      "cartocss_version": "2.1.1", 
      "cartocss": "#layer { polygon-fill: #FFF; }",
      "sql": "select * from european_countries_e",
      "interactivity": ["cartodb_id", "iso3"]
    }
  }]
}
```

Should be a [Mapconfig](https://github.com/CartoDB/Windshaft/blob/0.19.1/doc/MapConfig-1.1.0.md).

#### Response

The response includes:

- **layergroupid**  
  The ID for that map, used to compose the URL for the tiles. The final URL is:

  ```html
  http://{account}.cartodb.com/api/v1/map/:layergroupid/{z}/{x}/{y}.png
  ```

- **updated_at**  
  The ISO date of the last time the data involved in the query was updated.

- **metadata** *(optional)*  
  Includes information about the layers. Some layers may not have metadata.

- **cdn_url**  
  URLs to fetch the data using the best CDN for your zone.

#### Example

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl 'http://documentation.cartodb.com/api/v1/map' -H 'Content-Type: application/json' -d @mapconfig.json
```

<div class="code-title">RESPONSE</div>
```javascript
{
  "layergroupid":"c01a54877c62831bb51720263f91fb33:0",
  "last_updated":"1970-01-01T00:00:00.000Z"
  "cdn_url": {
    "http": "http://cdb.com",
    "https": "https://cdb.com"
  }
}
```

The tiles can be accessed using:

```bash
http://documentation.cartodb.com/api/v1/map/c01a54877c62831bb51720263f91fb33:0/{z}/{x}/{y}.png
```

For UTF grid tiles:

```bash
http://documentation.cartodb.com/api/v1/map/c01a54877c62831bb51720263f91fb33:0/:layer/{z}/{x}/{y}.grid.json
```

For attributes defined in `attributes` section:

```bash
http://documentation.cartodb.com/api/v1/map/c01a54877c62831bb51720263f91fb33:0/:layer/attributes/:feature_id
```

Which returns JSON with the attributes defined, like:

```javascript
{ c: 1, d: 2 }
```

Notice UTF Grid and attributes endpoints need an integer parameter, ``layer``. That number is the 0-based index of the layer inside the mapconfig. So in this case 0 returns the UTF grid tiles/attributes for layer 0, the only layer in the example mapconfig. If a second layer was available it could be returned with 1, a third layer with 2, etc.

### Create JSONP

The JSONP endpoint is provided in order to allow web browsers access which don't support CORS.

#### Definition

<div class="code-title notitle code-request"></div>
```bash
GET /api/v1/map?callback=method
```

#### Params

- **config**
  Encoded JSON with the params for creating named maps (the variables defined in the template).

- **lmza**  
  This attribute contains the same as config but LZMA compressed. It cannot be used at the same time as `config`.

- **callback**  
  JSON callback name.

#### Example

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl "https://documentation.cartodb.com/api/v1/map?callback=callback&config=%7B%22version%22%3A%221.0.1%22%2C%22layers%22%3A%5B%7B%22type%22%3A%22cartodb%22%2C%22options%22%3A%7B%22sql%22%3A%22select+%2A+from+european_countries_e%22%2C%22cartocss%22%3A%22%23european_countries_e%7B+polygon-fill%3A+%23FF6600%3B+%7D%22%2C%22cartocss_version%22%3A%222.3.0%22%2C%22interactivity%22%3A%5B%22cartodb_id%22%5D%7D%7D%5D%7D"
```

<div class="code-title">RESPONSE</div>
```javascript
callback({
    layergroupid: "d9034c133262dfb90285cea26c5c7ad7:0",
    cdn_url: {
        "http": "http://cdb.com",
        "https": "https://cdb.com"
    },
    last_updated: "1970-01-01T00:00:00.000Z"
})
```

### Remove

Anonymous maps cannot be removed by an API call. They will expire after about five minutes but sometimes longer. If an anonymous map expires and tiles are requested from it, an error will be raised. This could happen if a user leaves a map open and after time returns to the map an attempts to interact with it in a way that requires new tiles (e.g. zoom). The client will need to go through the steps of creating the map again to fix the problem.


## Named Maps

Named maps are essentially the same as anonymous maps except the mapconfig is stored on the server and the map is given a unique name. Two other big differences are that you can create named maps from private data, and that users without an API Key can see them even though they are from that private data.

The main two differences compared to anonymous maps are:

- **auth layer**  
  This allows you to control who is able to see the map based on a token auth

- **templates**  
  Since the mapconfig is static it can contain some variables so the client can modify the map's appearance using those variables

Template maps are persistent with no preset expiration. They can only be created or deleted by a CartoDB user with a valid API_KEY (see [auth section](http://docs.cartodb.com/cartodb-platform/maps-api.html#auth)).

### Create

#### Definition

<div class="code-title notitle code-request"></div>
```html
POST /api/v1/map/named
```

#### Params

- **api_key** is required

<div class="code-title">template.json</div>
```javascript
{
  "version": "0.0.1",
  "name": "template_name",
  "auth": {
    "method": "token",
    "valid_tokens": [
      "auth_token1",
      "auth_token2"
    ]
  },
  "placeholders": {
    "color": {
      "type": "css_color",
      "default": "red"
    },
    "cartodb_id": {
      "type": "number",
      "default": 1
    }
  },
  "layergroup": {
    "version": "1.0.1",
    "layers": [
      {
        "type": "cartodb",
        "options": {
          "cartocss_version": "2.1.1",
          "cartocss": "#layer { polygon-fill: <%= color %>; }",
          "sql": "select * from european_countries_e WHERE cartodb_id = <%= cartodb_id %>"
        }
      }
    ]
  }
}
```

##### Arguments

- **name**: There can be at most _one_ template with the same name for any user. Valid names start with a letter, and only contain letters, numbers, or underscores (_).
- **auth**:
  - **method** `"token"` or `"open"` (the default if no `"method"` is given).
  - **valid_tokens** when `"method"` is set to `"token"`, the values listed here allow you to instantiate the named map.
- **placeholders**: Variables not listed here are not substituted. Variable not provided at instantiation time trigger an error. A default is required for optional variables. Type specification is used for quoting, to avoid injections see template format section below.
- **layergroup**: the layer list definition. This is the MapConfig explained in anonymous maps. See [MapConfig documentation](https://github.com/CartoDB/Windshaft/blob/master/doc/MapConfig-1.1.0.md) for more info.

#### Template Format

A templated `layergroup` allows the use of placeholders in the "cartocss" and "sql" elements of the "option" object in any "layer" of a `layergroup` configuration

Valid placeholder names start with a letter and can only contain letters, numbers, or underscores. They have to be written between the `<%=` and `%>` strings in order to be replaced.

##### Example

```javascript
<%= my_color %>
```

The set of supported placeholders for a template will need to be explicitly defined with a specific type and default value for each.

#### Placeholder Types

The placeholder type will determine the kind of escaping for the associated value. Supported types are:

- **sql_literal** internal single-quotes will be sql-escaped
- **sql_ident** internal double-quotes will be sql-escaped
- **number** can only contain numerical representation
- **css_color** can only contain color names or hex-values

Placeholder default values will be used whenever new values are not provided as options at the time of creation on the client. They can also be used to test the template by creating a default version with now options provided.

When using templates, be very careful about your selections as they can give broad access to your data if they are defined losely.

<div class="code-title code-request with-result">REQUEST</div>
```html
curl -X POST \
   -H 'Content-Type: application/json' \
   -d @template.json \
   'https://documentation.cartodb.com/api/v1/map/named?api_key=APIKEY'
```

<div class="code-title">RESPONSE</div>
```javascript
{
  "template_id":"name",
}
```

### Instantiate

Instantiating a map allows you to get the information needed to fetch tiles. That temporal map is an anonymous map.

#### Definition

<div class="code-title notitle code-request"></div>
```html
POST /api/v1/map/named/:template_name
```

#### Param

- **auth_token** optional, but required when `"method"` is set to `"token"`

```javascript
// params.json
{
 "color": "#ff0000",
 "cartodb_id": 3
}
```

The fields you pass as `params.json` depend on the variables allowed by the named map. If there are variables missing it will raise an error (HTTP 400).

- **auth_token** *optional* if the named map needs auth

#### Example

You can initialize a template map by passing all of the required parameters in a POST to `/api/v1/map/named/:template_name`.

Valid credentials will be needed if required by the template.

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl -X POST \
  -H 'Content-Type: application/json' \
  -d @params.json \
  'https://documentation.cartodb.com/api/v1/map/named/@template_name?auth_token=AUTH_TOKEN'
```

<div class="code-title">Response</div>
```javascript
{
  "layergroupid": "docs@fd2861af@c01a54877c62831bb51720263f91fb33:123456788",
  "last_updated": "2013-11-14T11:20:15.000Z"
}
```

<div class="code-title">Error</div>
```javascript
{
  "error": "Some error string here"
}
```

You can then use the `layergroupid` for fetching tiles and grids as you would normally (see anonymous map section).  However, you'll need to show the `auth_token`, if required by the template.

### Using JSONP

There is also a special endpoint to be able to initialize a map using JSONP (for old browsers).

#### Definition

<div class="code-title notitle code-request"></div>
```bash
GET /api/v1/map/named/:template_name/jsonp
```

#### Params

- **auth_token** optional, but required when `"method"` is set to `"token"`
- **config** Encoded JSON with the params for creating named maps (the variables defined in the template)
- **lmza** This attribute contains the same as config but LZMA compressed. It cannot be used at the same time than `config`.
- **callback:** JSON callback name

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl 'https://documentation.cartodb.com/api/v1/map/named/:template_name/jsonp?auth_token=AUTH_TOKEN&callback=callback&config=template_params_json'
```

<div class="code-title">RESPONSE</div>
```javascript
callback({
  "layergroupid":"c01a54877c62831bb51720263f91fb33:0",
  "last_updated":"1970-01-01T00:00:00.000Z"
  "cdn_url": {
    "http": "http://cdb.com",
    "https": "https://cdb.com"
  }
})
```

This takes the `callback` function (required), `auth_token` if the template needs auth, and `config` which is the variable for the template (in cases where it has variables). 

```javascript
url += "config=" + encodeURIComponent(
JSON.stringify({ color: 'red' });
```

The response is in this format:

```javascript
callback({
  layergroupid: "dev@744bd0ed9b047f953fae673d56a47b4d:1390844463021.1401",
  last_updated: "2014-01-27T17:41:03.021Z"
})
```

### Update

#### Definition

<div class="code-title notitle code-request"></div>
```bash
PUT /api/v1/map/named/:template_name
```

#### Params

- **api_key** is required

#### Response

Same as updating a map.

#### Other Info

Updating a named map removes all the named map instances so they need to be initialized again.

#### Example

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl -X PUT \
  -H 'Content-Type: application/json' \
  -d @template.json \
  'https://documentation.cartodb.com/api/v1/map/named/:template_name?api_key=APIKEY'
```

<div class="code-title">RESPONSE</div>
```javascript
{
  "template_id": "@template_name"
}
```

If any template has the same name, it will be updated.

If a template with the same name does NOT exist, a 400 HTTP response is generated with an error in this format:

```javascript
{
  "error": "error string here"
}
```

### Delete 

Delete the specified template map from the server and disables any previously initialized versions of the map.

#### Definition

<div class="code-title notitle code-request"></div>
```bash
DELETE /api/v1/map/named/:template_name
```

#### Params

- **api_key** is required

#### Example

<div class="code-title code-request">REQUEST</div>
```bash
curl -X DELETE 'https://documentation.cartodb.com/api/v1/map/named/:template_name?api_key=APIKEY'
```

<div class="code-title">RESPONSE</div>
```javascript
{
  "error": "Some error string here"
}
```

On success, a 204 (No Content) response would be issued. Otherwise a 4xx response with with an error will be returned.

### Listing Available Templates

This allows you to get a list of all available templates. 

#### Definition

<div class="code-title notitle code-request"></div>
```bash
GET /api/v1/map/named/
```

#### Params

- **api_key** is required

#### Example

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl -X GET 'https://documentation.cartodb.com/api/v1/map/named?api_key=APIKEY'
```

<div class="code-title with-result">RESPONSE</div>
```javascript
{
   "template_ids": ["@template_name1","@template_name2"]
}
```

<div class="code-title">ERROR</div>
```javascript
{
   "error": "Some error string here"
}
```

### Getting a Specific Template

This gets the definition of a template.

#### Definition

<div class="code-title notitle code-request"></div>
```bash
GET /api/v1/map/named/:template_name
```

#### Params

- **api_key** is required

#### Example

<div class="code-title code-request with-result">REQUEST</div>
```bash
curl -X GET 'https://documentation.cartodb.com/api/v1/map/named/:template_name?api_key=APIKEY'
```

<div class="code-title with-result">RESPONSE</div>
```javascript
{
  "template": {...} // see template.json above
}
```

<div class="code-title">ERROR</div>
```javascript
{
  "error": "Some error string here"
}
```

### Use with CartoDB.js
Named maps can be used with CartoDB.js by specifying a named map in a layer source as follows. Named maps are treated almost the same as other layer source types in most other ways.

```js
var layerSource = {
  user_name: '{your_user_name}', 
  type: 'namedmap', 
  named_map: { 
    name: '{template_name}', 
	layers: [{ 
	  layer_name: "layer1", 
      interactivity: "column1, column2, ..." 
	}] 
  } 
}

cartodb.createLayer('map_dom_id',layerSource)
  .addTo(map_object);

```

See [CartoDB.js](http://docs.cartodb.com/cartodb-platform/cartodb-js.html) methods [layer.setParams()](http://docs.cartodb.com/cartodb-platform/cartodb-js.html#layersetparamskey-value) and [layer.setAuthToken()](http://docs.cartodb.com/cartodb-platform/cartodb-js.html#layersetauthtokenauthtoken).
