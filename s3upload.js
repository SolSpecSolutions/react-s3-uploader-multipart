/**
 * Taken, CommonJS-ified, and heavily modified from:
 * https://github.com/flyingsparx/NodeDirectUploader
 */

var Evaporate = require('evaporate');
var JSZip = require('jszip');

S3Upload.prototype.server = '';
S3Upload.prototype.signingUrl = '/sign-s3';
S3Upload.prototype.signingUrlMethod = 'GET';
S3Upload.prototype.signingUrlSuccessResponses = [200, 201];
S3Upload.prototype.fileElement = null;
S3Upload.prototype.files = null;

S3Upload.prototype.onFinishS3Put = function(signResult, file) {
    return console.log('base.onFinishS3Put()', signResult.publicUrl);
};

S3Upload.prototype.preprocess = function(file, next) {
    var zip = new JSZip();
    zipped = zip.file(file.name, file);
    console.log('base.preprocess()', zipped);
    return next(zipped);
};

S3Upload.prototype.onProgress = function(percent, status, file) {
    return console.log('base.onProgress()', percent, status);
};

S3Upload.prototype.onError = function(status, file) {
    return console.log('base.onError()', status);
};

S3Upload.prototype.scrubFilename = function(filename) {
    return filename.replace(/[^\w\d_\-\.]+/ig, '');
};

function S3Upload(options) {
    if (options == null) {
        options = {};
    }
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    var files = this.fileElement ? this.fileElement.files : this.files || [];
    this.handleFileSelect(files);
}

S3Upload.prototype.handleFileSelect = function(files) {
    var result = [];
    for (var i=0; i < files.length; i++) {
        var file = files[i];
        this.preprocess(file, function(processedFile){
          this.onProgress(0, 'Waiting', processedFile);
          result.push(this.uploadFile(processedFile));
          return result;
        }.bind(this));
    }
};

S3Upload.prototype.uploadToS3 = function(file) {
    var evaporateOptions = Object.assign(this.evaporateOptions, {
        signerUrl: this.signingUrl
    });
    return Evaporate.create(evaporateOptions).then(function(evaporate){
      var addConfig = {
        name: this.s3Path + file.name,
        file: file,
        progress: function(progressValue, stats){
          return this.onProgress(progressValue, progressValue === 100 ? 'Finalizing' : 'Uploading', file, stats);
        }.bind(this),
        complete: function(_xhr, awsKey){
          if (_xhr.status === 200) {
            this.onProgress(100, 'Upload completed', file);
          } else {
            return this.onError('Upload error: ' + _xhr.status, file);
          }
        }.bind(this),
        error: function(msg){
          return this.onError(msg, file);
        }.bind(this)
      };
      this.evaporate = evaporate;
      evaporate.add(addConfig).then(
        function(awsKey){
          return this.onFinishS3Put(awsKey, file);
        }.bind(this),
        function(errorReason){
          return this.onError(errorReason, file);
        }.bind(this)
      );
    }.bind(this));
};

S3Upload.prototype.uploadFile = function(file) {
    return this.uploadToS3(file);
};

S3Upload.prototype.abortUpload = function(filename) {
  if (filename !== undefined){
    return this.evaporate && this.evaporate.cancel(
      this.evaporateOptions.bucket + '/' + this.s3Path + filename
    );
  }else{
    return this.evaporate && this.evaporate.cancel();
  }
};

module.exports = S3Upload;
