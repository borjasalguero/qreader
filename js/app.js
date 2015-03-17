window.onload = function() {

  // Adding QR functionality
  var video, canvas, ctx;
  var pairingPanel;
  var server = 'http://logofid.es/qreader_github/';
  navigator.getMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

  function drawCanvas() {
    ctx.drawImage(video,0,0);
    try{
      qrcode.decode();
    }
    catch(e){
      setTimeout(drawCanvas, 500);
    };
  }

  var isLaunched = false;
  function launchReader() {
    if (isLaunched) {
      return;
    }

    isLaunched = true;
    navigator.getMedia(
      {
        video: true,
        audio: false
      },
      function(stream) {
        document.body.classList.add('scanning');
        pairingPanel = document.createElement('div');
        pairingPanel.id = 'pairing-panel';
        document.body.appendChild(pairingPanel);
        // Create a CB from the library. Will be executed
        // once the QR will be resolved.
        qrcode.callback = function(url) {
          document.body.removeChild(pairingPanel);
          document.body.classList.remove('scanning');

          var text_read = document.getElementById('text_read');
          text_read.textContent = url;

          var reader = document.getElementById('reader');
          reader.removeAttribute('loading');

          var action, button_text;
          if (!navigator.mozApps) {
            reader.setAttribute('color', 'green');
            action = function() {
              window.location.reload();
            };
            button_text = 'Reload';
          } else {
            reader.setAttribute('color', 'dark-green');
            button_text = 'Share';
            action = function() {
              new MozActivity({
                name: 'share',
                data: {
                  type: 'url',
                  url: url
                }
              });
            }
          }

          reader.textContent = button_text;


          reader.addEventListener(
            'click',
            function() {
              action();
            }
          );
        }

        video = document.createElement('video');
        video.muted = true;
        if (navigator.webkitGetUserMedia) {
          video.src = window.URL.createObjectURL(stream);
        } else {
          video.mozSrcObject = stream;
        }


        pairingPanel.appendChild(video);
        video.play();
        video.addEventListener('canplay', function() {
          function renderCanvas() {
            var p = document.createElement('p');
            var w = video.videoWidth;
            var h = video.videoHeight;
            if (w > h) {
              video.classList.add('horizontal');
            } else {
              video.classList.add('vertical');
            }
            p.textContent = 'width ' + w + 'heigth ' + h;
            pairingPanel.appendChild(p);

            canvas = document.createElement('canvas');
            canvas.id = 'qr-canvas';
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            canvas.width = w;
            canvas.height = h;
            pairingPanel.appendChild(canvas);
            ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, w, h);

            setTimeout(drawCanvas, 500);
          }
          // This is a HACK. 'canplay' is not working as expected
          // so we need to wait until having the first working frame
          // in the video stream for rendering the canvas.
          var pollingInterval = window.setInterval(function() {
            if (video.mozPaintedFrames == 0) {
              return;
            }
            window.clearInterval(pollingInterval);
            renderCanvas()
          }, 100);
        });
      },
      function(error) {
        console.log('Error while showing own video stream through gUM ' + JSON.stringify(error));
        if (!pairingPanel) {
          return;
        }
        document.body.classList.remove('scanning');
        document.body.removeChild(pairingPanel);
        window.close();
      }
    );
  }

  if (window.navigator.mozApps) {
    var request = window.navigator.mozApps.checkInstalled(server + 'manifest_hosted.webapp');
    request.onerror = function(e) {
      console.log("Error calling checkInstalled");
    };
    request.onsuccess = function(e) {
      if (request.result) {
        console.log("App is installed!");
      }
      else {
        var installButton = document.getElementById('install');
        installButton.classList.remove('hidden');
        installButton.addEventListener(
          'click',
          function() {
            var request = window.navigator.mozApps.install(server + 'manifest_hosted.webapp');
            request.onsuccess = function () {
              installButton.classList.add('hidden');
              alert('Installation successful!');
            };
            request.onerror = function () {
              // Display the error information from the DOMError object
              alert('Install failed, error: ' + this.error.name);
            };
          }
        );
      }
    };
  }

  document.getElementById('close').addEventListener(
    'click',
    function() {
      window.close();
    }
  );


  document.getElementById('update').addEventListener(
    'click',
    function() {
      var confirm = window.confirm('¿Quieres comprobar si hay alguna actualizacion?');
      if (confirm) {
        window.applicationCache.update();
      }
    }
  );

  var appCache = window.applicationCache;

  function handleCacheEvent() {
    switch (appCache.status) {
      case appCache.UNCACHED: // UNCACHED == 0
        console.log('UNCACHED');
        launchReader();
        break;
      case appCache.IDLE: // IDLE == 1
        console.log('IDLE');
        launchReader();
        break;
      case appCache.CHECKING: // CHECKING == 2
        console.log('CHECKING');
        break;
      case appCache.DOWNLOADING: // DOWNLOADING == 3
        console.log('DOWNLOADING');
        break;
      case appCache.UPDATEREADY:  // UPDATEREADY == 4
        console.log('UPDATEREADY!!!!!');
        appCache.swapCache();
        var confirm = window.confirm('Hemos detectado una nueva versión, ¿quieres disfrutarla ahora?');
        if (!confirm) {
          launchReader();
          return;
        }
        window.location.reload(true);
        break;
      case appCache.OBSOLETE: // OBSOLETE == 5
        console.log('OBSOLETE');
        break;
      default:
        console.log('UKNOWN CACHE STATUS');
        break;
    };
  }

  function handleCacheError() {
    console.log('ERROR CARGANDO LA CACHE');
  }


  // Fired after the first cache of the manifest.
  appCache.addEventListener('cached', handleCacheEvent, false);

  // Checking for an update. Always the first event fired in the sequence.
  appCache.addEventListener('checking', handleCacheEvent, false);

  // An update was found. The browser is fetching resources.
  appCache.addEventListener('downloading', handleCacheEvent, false);

  // The manifest returns 404 or 410, the download failed,
  // or the manifest changed while the download was in progress.
  appCache.addEventListener('error', handleCacheError, false);

  // Fired after the first download of the manifest.
  appCache.addEventListener('noupdate', handleCacheEvent, false);

  // Fired if the manifest file returns a 404 or 410.
  // This results in the application cache being deleted.
  appCache.addEventListener('obsolete', handleCacheEvent, false);

  // Fired for each resource listed in the manifest as it is being fetched.
  appCache.addEventListener('progress', handleCacheEvent, false);

  // Fired when the manifest resources have been newly redownloaded.
  appCache.addEventListener('updateready', handleCacheEvent, false);


}