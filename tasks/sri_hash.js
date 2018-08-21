module.exports = function(grunt) {
  const crypto = require('crypto');
  const path = require('path');
  const jsdom = require('jsdom');

  const { JSDOM } = jsdom;
  const hashMap = new Map();

  grunt.registerMultiTask('sri_hash', 'Hash all scripts and stylesheets with integrity attributes.', function() {

    const options = this.options({
      algorithm: 'sha384',
      selector: 'link[rel=stylesheet][href]:not([integrity]):not([href^="http"]):not([href^="//"], script[src]:not([integrity]):not([src^="http"]):not([src^="//"])',
      assetsDir: '',
    });

    const getHash = (url, algorithm) => {
      if (!hashMap.has(url)) {
        hashMap.set(url, [algorithm, calcHash(url, algorithm)].join('-'));
      }

      return hashMap.get(url);
    };

    const calcHash = (url, algorithm) => {
      const fileContent = grunt.file.read(url).replace(/[.]{2}\//g);
      // openssl dgst -sha384 -binary file.js | openssl base64 -A
      return crypto.createHash(algorithm).update(fileContent).digest('base64');
    };

    this.files.forEach((filePair) => {
      // check that the source file exists
      if (filePair.src.length === 0) { return; }

      // init dom
      const dom = new JSDOM(grunt.file.read(filePair.src));
      const doc = dom.window.document;

      grunt.log.writeln(('Reading: ').green + path.resolve(filePair.src.toString()));

      const scripts_dom = doc.querySelectorAll(options.selector);
      if (scripts_dom.length) {
        scripts_dom.forEach((file) => {
          const url = file.getAttribute('src') || file.getAttribute('href');
          const urlClean = url.replace(/\?(.+)?$/, '');
          const filePath = (urlClean.substr(0, 1) === '/') ? path.resolve(options.assetsDir, urlClean.substr(1)) : path.join(path.dirname(filePair.src.toString()), urlClean);
          const hash = getHash(filePath, options.algorithm);

          if (file.getAttribute('crossorigin') !== 'use-credentials') {
            file.setAttribute('crossorigin', 'anonymous');
          }

          file.setAttribute('integrity', hash);

          grunt.log.writeln(('  ' + hash + ': ').blue + filePath);
        })
      }

      const html = dom.serialize();
      grunt.file.write(path.resolve(filePair.dest), html);
      grunt.log.writeln(('Created: ').green + path.resolve(filePair.dest) + '\n');
    });

    hashMap.clear();
  });
};
