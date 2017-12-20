var IframeHttpRequest = (function() {
  var extend = function(dest, source) {
    var newDest = dest;
    for (key in source) {
      if (source.hasOwnProperty(key)) {
        newDest[key] = source[key];
      }
    }

    return newDest;
  };

  var extractDataFromForm = function(formEl) {
    var data = {};
    var i = -1;
    var fields = Array.prototype.slice.call(formEl.elements);

    while (++i < fields.length) {
      var currentField = fields[i];
      if (currentField.type !== 'file' && currentField.type !== 'submit' && currentField.name) {
        data[currentField.name] = currentField.value;
      }
    }

    return data;
  };

  var extractFilesFromForm = function(formEl) {
    var files = [];
    var fields = Array.prototype.slice.call(formEl.elements);
    var i = -1;

    while (++i < fields.length) {
      var currentField = fields[i];

      if (currentField.type === 'file') {
        files.push(currentField);
      }
    }

    return files;
  };

  var createIframe = (name) => {
    var frame = document.createElement('iframe');

    frame.style.display = 'none';
    frame.src = 'about:blank';
    frame.id = name;
    frame.name = name;

    return frame;
  };

  var createMultipartForm = function(actionUrl, targetName) {
    var f = document.createElement('form');

    f.style.display = 'none';
    f.method = 'post';
    f.target = targetName;
    f.action = actionUrl;
    f.enctype = 'multipart/form-data';

    return f;
  };

  var populateFormData = function(params) {
    var form = params.form;
    var data = params.data;
    var files = params.files;

    for (inputName in data) {
      if (data.hasOwnProperty(inputName)) {
        var value = data[inputName];
        var hiddenInput = document.createElement('input');

        hiddenInput.name = inputName;
        hiddenInput.type = 'hidden';
        hiddenInput.value = value;

        form.appendChild(hiddenInput);
      }
    }

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var fileClone = file.cloneNode(true);
      form.appendChild(fileClone);
    }
  };

  var createIframeLoadHandler = function(iframeReq, form) {
    var settings = iframeReq.settings;

    var handler = function(e) {
      var iframe = this;

      if (iframeReq.iframeFirstLoad) {
        iframeReq.requestTimeout = setTimeout(function() {
          iframeReq.handleError();
        }, settings.timeout);

        form.submit();

        // Set initial load flag to false
        iframeReq.iframeFirstLoad = false;
      } else {
        var doc;

        if (iframeReq.requestTimeout) {
          clearTimeout(iframeReq.requestTimeout);
        }

        try {
          doc = iframe.contentWindow ?
          iframe.contentWindow.document :
          (iframe.contentDocument ? iframe.contentDocument : iframe.document);
        } catch(err) {
          return iframeReq.handleError(err);
        }

        var responseText = doc.body.textContent;
        var responseHtml = doc.body.innerHTML;

        iframeReq.finishCallback && iframeReq.finishCallback(null, {
          responseText: responseText,
          responseHtml: responseHtml
        });

        setTimeout(function() {
          iframeReq.cleanup();
        }, 0);
      }
    };

    return handler;
  };

  var defaults = {
    timeout: 5000, // 5 seconds
    files: [],
    data: {}
  };

  function IframeHttpRequest(options) {
    var reqOptions = options || {};
    this.settings = extend(defaults, reqOptions);
    this.iframeFirstLoad = true;
  }

  IframeHttpRequest.prototype.send = function(cb) {
    var settings = this.settings;
    this.finishCallback = cb;

    if (settings.formEl) {
      this._data = extractDataFromForm(settings.formEl);
      this._files = extractFilesFromForm(settings.formEl);
    } else {
      this._data = settings.data;
      this._files = settings.files;
    }

    this._prepareAndSendIframeReq();
  };

  IframeHttpRequest.prototype.cleanup = function() {
    this._iframe.onload = null;
    this._iframe.parentNode.removeChild(this._iframe);
    this._form.parentNode.removeChild(this._form);
    this.iframeFirstLoad = true;
  };

  IframeHttpRequest.prototype.handleError = function(err) {
    this.cleanup();
    this.finishCallback &&
      this.finishCallback(err || new Error('Error posting to ' + this.settings.url));
  };

  IframeHttpRequest.prototype._prepareAndSendIframeReq = function() {
    var body = document.body;
    var iframeName = 'transport-iframe-' + Date.now();
    var iframe = createIframe(iframeName);
    var form = createMultipartForm(this.settings.url || this.settings.formEl.action, iframeName);

    // Add data to iframe form
    populateFormData({
      data: this._data,
      files: this._files,
      form: form
    });

    this._iframeLoadHandler = createIframeLoadHandler(this, form);
    this._iframe = iframe;
    this._form = form;

    iframe.onload = this._iframeLoadHandler;

    body.appendChild(form);
    body.appendChild(iframe);
  };

  return IframeHttpRequest;
})();

if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
  module.exports = IframeHttpRequest;
} else {
  window.IframeHttpRequest = IframeHttpRequest;
}
