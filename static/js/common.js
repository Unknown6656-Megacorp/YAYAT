'use strict';

const TASK_PROGRESS = {
    NOT_YET_STARTED: 0,
    IN_PROGRESS: 1,
    COMPLETED: 2,
};
const API_METHOD = 'POST';


function query_api_sync(path, obj, success, error)
{
    $.ajax({
        url: `/api/${path}`,
        data: API_METHOD == 'GET' ? obj : JSON.stringify(obj),
        type: API_METHOD,
        dataType: 'json',
        contentType: 'application/json',
        success: d => success(d.response),
        error: e => error(e.responseJSON?.error || e.statusText || '[Unknown Error]'),
    });
}

async function query_api(path, obj, error)
{
    try
    {
        const result = await $.ajax({
            url: `/api/${path}`,
            data: API_METHOD == 'GET' ? obj : JSON.stringify(obj),
            type: API_METHOD,
            dataType: 'json',
            contentType: 'application/json',
        });

        return result.response;
    }
    catch (err)
    {
        error(err.responseJSON?.error || e.statusText || '[Unknown Error]');

        return undefined;
    }
}

function uuid()
{
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function get_random_color()
{
    return '#' + Math.floor(Math.random() * 0xFFFFFF << 0).toString(16);
}

function print_relative_utc(utc)
{
    const now = new Date();
    const date = new Date(Date.parse(utc));
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60)
        return `${seconds < 5 ? 'a couple of' : seconds} seconds ago`;
    else if (seconds < 3600)
        return `${Math.floor(seconds / 60)} minutes ago`;
    else if (seconds < 86400)
        return `${Math.floor(seconds / 3600)} hours ago`;
    else
    {
        const days = Math.floor(seconds / 86400);

        if (days < 1)
            return 'today';
        else if (days < 2)
            return 'yesterday';
        else if (days == 7)
            return 'a week ago';
        else if (days == 14)
            return 'two weeks ago';
        else if (days < 14)
            return `${days} days ago`;
        else
            return `on ${date.getDate()} ${date.toLocaleString('en', { month: 'long' })} ${date.getFullYear()}`;
    }
}

function print_absolute_utc(utc)
{
    const date = new Date(Date.parse(utc));

    return `${date.getFullYear().toString().padStart(4, '0')}-${date.getMonth().toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

function unescape_html(html)
{
    return html.replace(/&[^;]*;/g, tag =>
    {
        return {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&#34;': '\'',
            '&#39;': '\"',
        }[tag] || tag;
    });
}

function hide_modal_notice()
{
    $('modal-container').addClass('hidden');
}

function show_modal_notice(title, text, actions)
{
    $('#modal-title').text(title);
    $('#modal-text').html(text);

    let html = '';

    for (const i in actions)
        html += `<button id="modal-button-${i}">${actions[i][0]}</button>`;

    $('#modal-buttons').html(html);
    $('modal-container').removeClass('hidden');

    for (const i in actions)
        $(`#modal-button-${i}`).click(function()
        {
            hide_modal_notice();
            actions[i][1]();
        });
}

function add_scroll_shadow(elems)
{
    for (let elem of elems)
    {
        const id = uuid();

        elem = $(elem);
        elem.attr('data-scroll-uuid', id);

        const scroll_shadow = $(`
            <scroll-shadow data-scroll-uuid="${id}">
            </scroll-shadow>
        `).insertAfter($('page-container'));

        new ResizeObserver(on_update).observe(elem[0]);
        addEventListener('resize', on_update);

        elem.on('DOMSubtreeModified scroll', on_scroll);
        $(window).scroll(on_update);

        on_scroll();

        function on_update()
        {
            const bounds = elem[0].getClientRects()[0];

            scroll_shadow.css({
                height: `${bounds.height}px`,
                width: `${bounds.width}px`,
                left: `${bounds.x}px`,
                top: `${bounds.y}px`,
            });
        }
        function on_scroll()
        {
            const scroll_top = elem.scrollTop();
            const scroll_bottom = elem[0].scrollHeight - elem.height() - scroll_top;

            if (scroll_top > 0)
                scroll_shadow.addClass('scroll-shadow-top');
            else
                scroll_shadow.removeClass('scroll-shadow-top');

            if (scroll_bottom > 0)
                scroll_shadow.addClass('scroll-shadow-bottom');
            else
                scroll_shadow.removeClass('scroll-shadow-bottom');

            on_update();
        }
    }
}


if (user)
    user.date = print_absolute_utc(user.date);

if ('serviceWorker' in navigator && use_service_worker)
    navigator.serviceWorker.register('/service-worker.js');


$('page-container > main.text').parent().css('overflow-y', 'auto');

$('.open[href]').click(elem => window.location.href = $(elem.target).attr('href'));

$('tab-control').each(function()
{
    const tab_control = $(this);
    const tab_header = $('<tab-header></tab-header>');

    tab_control.prepend(tab_header);

    for (let tab_page of tab_control.children('tab-page'))
    {
        const id = uuid();

        tab_page = $(tab_page);
        tab_page.attr('data-id', id);
        tab_header.append(`<button data-id="${id}">${tab_page.attr('header')}</button>`);
    }

    tab_header.append('<tab-header-filler></tab-header-filler>');
    tab_header.children('button[data-id]').click(e =>
    {
        const button = $(e.target);
        const id = button.attr('data-id');

        tab_header.children('button[data-id]').removeClass('active');
        button.addClass('active');
        tab_control.children('tab-page').removeClass('active');
        tab_control.find(`tab-page[data-id="${id}"]`).addClass('active');
    }).first().click();
});




add_scroll_shadow($('.scroll-shadows'));
