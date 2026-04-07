const fs = require('fs');
const http = require('http');

// A very fast, hacky way without libraries: read header of PNG to find dimensions!
// Even better, I will just install jimp in a temp dir and check.
