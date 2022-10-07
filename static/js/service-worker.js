'use strict';

const CACHE_NAME = 'offline-cache-v1';
const CACHE_URLS = [
    // '/service-worker.js',
    '/js/jquery.js',
    '/js/common.js',

    '/css/bahnschrift.css',
    '/css/cascadia.css',
    '/css/common.css',

    '/font/bahnschrift.woff2',

    '/favicon.ico',
    '/img/favicon-16.png',
    '/img/favicon-32.png',
    '/img/favicon-180.png',
];
const OFFLINE_URL = '/offline';


self.addEventListener('install', event =>
{
    self.skipWaiting();
    event.waitUntil((async function()
    {
        const cache = await caches.open(CACHE_NAME);

        await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        await cache.addAll(CACHE_URLS);
    })());
});

self.addEventListener('activate', event => event.waitUntil((async function()
{
    if (self.registration && 'navigationPreload' in self.registration)
        await self.registration.navigationPreload.enable();

    const names = await caches.keys();

    names.forEach(name =>
    {
        if(name !== CACHE_NAME)
            return caches.delete(CACHE_NAME);
    });

    // await self.clients.claim();
})()));

self.addEventListener('fetch', event =>
{
    const { request } = event;
    let url = request.url;

    if (request.headers.has('range'))
        return;
    else
        event.respondWith((async function()
        {
            const cache = await caches.open(CACHE_NAME);
            let response = await cache.match(request);

            if (response)
                return response;
            else
                try
                {
                    response = 'navigationPreload' in self.registration ? await event.preloadResponse : undefined;
                    response = response || await fetch(event.request);

                    return response;
                }
                catch (error)
                {
                    if ((request.mode === 'navigate' || request.mode === 'no-cors') && request.method === 'GET')
                    {
                        response = await cache.match(OFFLINE_URL);

                        return response;
                    }
                    else
                        throw error;
                }
        })());
});

