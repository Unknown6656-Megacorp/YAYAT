'use strict';

const CACHE_NAME = 'yayat-offline-v1';
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
    event.waitUntil((async function()
    {
        const cache = await caches.open(CACHE_NAME);

        await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        await cache.addAll(CACHE_URLS);
    })());
    // self.skipWaiting();
});

self.addEventListener('activate', event => event.waitUntil((async function()
{
    if ('navigationPreload' in self.registration)
        await self.registration.navigationPreload.enable();

    const names = await caches.keys();

    names.forEach(name =>
    {
        if(name !== CACHE_NAME)
            return caches.delete(CACHE_NAME);
    });

    await self.clients.claim();

    return Promise.all(names);
})()));

self.addEventListener('fetch', event =>
{
    if (event.request.mode in ['navigate', 'no-cors'] && event.request.method === 'GET')
        event.respondWith((async function()
        {
            try
            {
                const preload ='navigationPreload' in self.registration ? await event.preloadResponse : undefined;

                if (preload)
                    return preload;
                else
                {
                    const response = await fetch(event.request);

                    return response;
                }
            }
            catch (error)
            {
                const cache = await caches.open(CACHE_NAME);
                const response = await cache.match(OFFLINE_URL);
                const keys = await cache.keys();

                console.log(keys);

                return response;
            }
        })());
});

