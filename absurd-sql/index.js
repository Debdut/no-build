import { initBackend } from '/vendor/absurd-sql/indexeddb-main-thread.js';

function init() {
    let worker = new Worker(new URL('./index.worker.js', import.meta.url), { type: 'module' });
    console.log('Worker created');

    // let worker = new Worker('index.worker.js');
    worker.postMessage('Hello to Worker');

    worker.onerror = function(error) {
        console.error('Worker Error: ', error.message);
    };

    worker.onmessage = function(event) {
        console.log('Message from worker: ', event.data);
    };

    initBackend(worker);
}

init();