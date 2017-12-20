function MultipartTransport(options = {}) {
      const body = document.body;
      let iframeFirstLoad = true;
      const iframeName = `transport-iframe-${Date.now()}`;
      const defaults = {
        timeout: 5000 // 5 seconds,
        files: [],
        data: {}
      };

      const settings = {...defaults, ...options};

      let data;
      let files;
      let iframe;
      let requestTimeout;
      let finishCallback;
      let form;

      const extractDataFromForm = (formEl) => {
        return Array.from(formEl.elements)
          .filter(el => el.type !== 'file' && el.type !== 'submit')
          .reduce((acc, currentEl) => ({
            ...acc,
            [currentEl.name]: currentEl.value
          }), {});
      };

      const extractFilesFromForm = (formEl) => {
        return Array.from(formEl.elements)
          .filter(el => el.type === 'file')
          .reduce((acc, currentEl) => [...acc, currentEl], []);
      };

      const createIframe = (name) => {
        const frame = document.createElement('iframe');

        frame.style.display = 'none';
        frame.src = 'about:blank';
        frame.id = name;
        frame.name = name;

        return frame;
      };

      const createMultipartForm = () => {
        const f = document.createElement('form');

        f.style.display = 'none';
        f.method = 'post';
        f.target = iframeName;
        f.action = settings.url || settings.formEl.action;
        f.enctype = 'multipart/form-data';

        return f;
      };

      const populateFormData = () => {
        Object.keys(data).forEach(inputName => {
          const value = data[inputName];
          const hiddenInput = document.createElement('input');

          hiddenInput.name = inputName;
          hiddenInput.type = 'hidden';
          hiddenInput.value = value;

          form.appendChild(hiddenInput);
        });

        files.forEach(file => {
          const fileClone = file.cloneNode(true);
          form.appendChild(fileClone);
        });
      };

      const cleanUp = () => {
        iframeFirstLoad = true;
        iframe.removeEventListener('load', handleIframeLoad);
        iframe.parentNode.removeChild(iframe);
        form.parentNode.removeChild(form);
      };

      const handleError = (err) => {
        cleanup();
        finishCallback && finishCallback(err || new Error(`Error posting to ${settings.url}`));
      };

      function handleIframeLoad(e) {
        if (iframeFirstLoad) {
          requestTimeout = setTimeout(handleError, settings.timeout);
          form.submit();
          iframeFirstLoad = false;
        } else {
          let doc;

          if (requestTimeout) {
            clearTimeout(requestTimeout);
          }

          try {
            doc = iframe.contentWindow ?
            iframe.contentWindow.document :
            (iframe.contentDocument ? iframe.contentDocument : iframe.document);
          } catch(err) {
            return handleError(err);
          }

          const responseText = doc.body.textContent;
          const responseHtml = doc.body.innerHTML;

          finishCallback && finishCallback(null, {
            responseText,
            responseHtml
          });

          setTimeout(cleanUp, 0);
        }
      }

      const getXhrFormData = () => {
        if (settings.formEl) {
          return new FormData(settings.formEl);
        } else {
          const formData = new FormData();

          Object.keys(data).forEach(inputName => formData.append(inputName, data[inputName]));
          Object.keys(files).forEach((file) => {
            if (file.multiple) {
              for (let i = 0; i < data[inputName].files.length; i++) {
                formData.append(file.name.replace(/([^\[\]]+)$/g, '$1[]'), data[inputName].files[i]);
              }
            } else {
              formData.append(file.name, data[inputName].files[0]);
            }
          });

          return formData;
        }
      };

      function iframeTransport() {
        iframe = createIframe(iframeName);
        form = createMultipartForm();

        populateFormData();

        iframe.addEventListener('load', handleIframeLoad, false);

        body.appendChild(form);
        body.appendChild(iframe);
      }

      function xhrTransport() {
        const formData = getXhrFormData();
        const req = new XMLHttpRequest();

        req.open('POST', settings.url, true);
        req.onload = (event) => {
          if (req.readyState === req.DONE) {
            if (req.status >= 200 && req.status < 300) {
              finishCallback && finishCallback(null, {responseText: req.responseText});
            } else {
              finishCallback && finishCallback(new Error(`Error: ${req.statusText}`));
            }
          }
        };
        req.responseType = 'text';
        req.send(formData);
      }

      return {
        send(cb) {
          finishCallback = cb;
          if (settings.formEl) {
            data = extractDataFromForm(settings.formEl);
            files = extractFilesFromForm(settings.formEl);
          } else {
            data = settings.data;
            files = settings.files;
          }

          if ('FormData' in window && !settings.iframe) {
            xhrTransport();
          } else {
            iframeTransport();
          }
        }
      };
    }
