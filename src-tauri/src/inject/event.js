const shortcuts = {
    ArrowUp: () => scrollTo(0, 0),
    ArrowDown: () => scrollTo(0, document.body.scrollHeight),
    // Don't use command + ArrowLeft or command + ArrowRight
    // When editing text in page, it causes unintended page navigation.
    // ArrowLeft: () => window.history.back(),
    // ArrowRight: () => window.history.forward(),
    '[': () => window.history.back(),
    ']': () => window.history.forward(),
    r: () => window.location.reload(),
    '-': () => zoomOut(),
    '=': () => zoomIn(),
    '+': () => zoomIn(),
    0: () => setZoom('100%'),
};

function setZoom(zoom) {
    const html = document.getElementsByTagName('html')[0];
    html.style.zoom = zoom;
    window.localStorage.setItem('htmlZoom', zoom);
}

function zoomCommon(zoomChange) {
    const currentZoom = window.localStorage.getItem('htmlZoom') || '100%';
    setZoom(zoomChange(currentZoom));
}

function zoomIn() {
    zoomCommon((currentZoom) => `${Math.min(parseInt(currentZoom) + 10, 200)}%`);
}

function zoomOut() {
    zoomCommon((currentZoom) => `${Math.max(parseInt(currentZoom) - 10, 30)}%`);
}

function handleShortcut(event) {
    if (shortcuts[event.key]) {
        event.preventDefault();
        shortcuts[event.key]();
    }
}

//这里参考 ChatGPT 的代码
const uid = () => window.crypto.getRandomValues(new Uint32Array(1))[0];

function transformCallback(callback = () => {
}, once = false) {
    const identifier = uid();
    const prop = `_${identifier}`;
    Object.defineProperty(window, prop, {
        value: (result) => {
            if (once) {
                Reflect.deleteProperty(window, prop);
            }
            return callback(result);
        },
        writable: false,
        configurable: true,
    });
    return identifier;
}

async function invoke(cmd, args) {
    return new Promise((resolve, reject) => {
        if (!window.__TAURI_POST_MESSAGE__)
            reject('__TAURI_POST_MESSAGE__ does not exist~');
        const callback = transformCallback((e) => {
            resolve(e);
            Reflect.deleteProperty(window, `_${error}`);
        }, true);
        const error = transformCallback((e) => {
            reject(e);
            Reflect.deleteProperty(window, `_${callback}`);
        }, true);
        window.__TAURI_POST_MESSAGE__({
            cmd,
            callback,
            error,
            ...args,
        });
    });
}

// Judgment of file download.
function isDownloadLink(url) {
    const fileExtensions = [
        '3gp', '7z', 'ai', 'apk', 'avi', 'bmp', 'csv', 'dmg', 'doc', 'docx', 'fla', 'flv', 'gif', 'gz', 'gzip',
        'ico', 'iso', 'indd', 'jar', 'jpeg', 'jpg', 'm3u8', 'mov', 'mp3', 'mp4', 'mpa', 'mpg',
        'mpeg', 'msi', 'odt', 'ogg', 'ogv', 'pdf', 'png', 'ppt', 'pptx', 'psd', 'rar', 'raw', 'rss', 'svg',
        'swf', 'tar', 'tif', 'tiff', 'ts', 'txt', 'wav', 'webm', 'webp', 'wma', 'wmv', 'xls', 'xlsx', 'xml', 'zip'
    ];
    const downloadLinkPattern = new RegExp(`\\.(${fileExtensions.join('|')})$`, 'i');
    return downloadLinkPattern.test(url);
}

// No need to go to the download link.
function externalDownLoadLink() {
    return ['quickref.me'].indexOf(location.hostname) > -1;
}

document.addEventListener('DOMContentLoaded', () => {
    const topDom = document.createElement('div');
    topDom.id = 'pack-top-dom';
    document.body.appendChild(topDom);
    const domEl = document.getElementById('pack-top-dom');

    domEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.buttons === 1 && e.detail !== 2) {
            invoke('drag_window');
        }
    });

    domEl.addEventListener('touchstart', () => {
        invoke('drag_window');
    });

    domEl.addEventListener('dblclick', () => {
        invoke('fullscreen');
    });

    document.addEventListener('keyup', (event) => {
        if (/windows|linux/i.test(navigator.userAgent) && event.ctrlKey) {
            handleShortcut(event);
        }
        if (/macintosh|mac os x/i.test(navigator.userAgent) && event.metaKey) {
            handleShortcut(event);
        }
    });

    // Prevent some special websites from executing in advance, before the click event is triggered.
    document.addEventListener('mousedown', (e) => {
        const anchorElement = e.target.closest('a');

        if (anchorElement && anchorElement.href) {
            const target = anchorElement.target;
            anchorElement.target = '_self';
            const hrefUrl = new URL(anchorElement.href);
            const absoluteUrl = hrefUrl.href;

            // Handling external link redirection.
            if (
                window.location.host !== hrefUrl.host &&
                (target === '_blank' || target === '_new')
            ) {
                e.preventDefault();
                invoke('open_browser', {url: absoluteUrl});
                return;
            }

            let filename = anchorElement.download ? anchorElement.download : getFilenameFromUrl(absoluteUrl)
            // Process download links for Rust to handle.
            // If the download attribute is set, the download attribute is used as the file name.
            if ((anchorElement.download || e.metaKey || e.ctrlKey || isDownloadLink(absoluteUrl))
                && !externalDownLoadLink()
            ) {
                e.preventDefault();
                invoke('download_file', {
                    params: {
                        url: absoluteUrl,
                        filename,
                    },
                });
            }
        }
    });

    // Rewrite the window.open function.
    const originalWindowOpen = window.open;
    window.open = function (url, name, specs) {
        // Apple login and google login
        if (name === 'AppleAuthentication') {
            //do nothing
        } else if (specs.includes('height=') || specs.includes('width=')) {
            location.href = url;
        } else {
            const baseUrl = window.location.origin + window.location.pathname;
            const hrefUrl = new URL(url, baseUrl);
            invoke('open_browser', {url: hrefUrl.href});
        }
        // Call the original window.open function to maintain its normal functionality.
        return originalWindowOpen.call(window, url, name, specs);
    };

    // Set the default zoom, There are problems with Loop without using try-catch.
    try {
        setDefaultZoom();
    } catch (e) {
        console.log(e);
    }
});

function setDefaultZoom() {
    const htmlZoom = window.localStorage.getItem('htmlZoom');
    if (htmlZoom) {
        setZoom(htmlZoom);
    }
}

function getFilenameFromUrl(url) {
    const urlPath = new URL(url).pathname;
    const filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
    return filename;
}

function removeUrlParameters(url) {
    const parsedUrl = new URL(url);
    parsedUrl.search = '';
    return parsedUrl.toString();
}


// Toggle video playback when the window is hidden.
function toggleVideoPlayback(pause) {
    const videos = document.getElementsByTagName('video');
    for (const video of videos) {
        if (pause) {
            video.pause();
        } else {
            video.play();
        }
    }
}

