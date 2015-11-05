# explorer-map-components
Leaflet based map components. It isn't replacing leaflet. These are convenience 
wrappers around leaflet to make it a bit easier to integrate with AngularJS

To get running with development.
* Node JS installed
* NPM installed 
* Install Gulp gloabally
* Run gulp for building

```sh
$ npm i -g gulp
```

```sh
$ npm install
```

```sh
$ gulp
```

The files will generate into:
dist

To use in another project include this as a dependency in the bower.json:
```sh
    "ga-explorer-map-components": "git@github.com:GeoscienceAustralia/explorer-map-components.git#*",
```

Run bower to install
```sh
bower install
```