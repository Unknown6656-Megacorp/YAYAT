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
        contentType: 'application/json; charset=utf-8',
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
            contentType: 'application/json; charset=utf-8',
        });

        return result.response;
    }
    catch (err)
    {
        error(err.responseJSON?.error || e.statusText || '[Unknown Error]');

        return undefined;
    }
}

function get_random_color()
{
    return '#' + Math.floor(Math.random() * 0xFFFFFF << 0).toString(16);
}

function print_utc(utc)
{
    const now = new Date();
    const date = Date.parse(utc);
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
            $('modal-container').addClass('hidden');
            actions[i][1]();
        });
}


$('page-container > main.text').parent().css('overflow-y', 'auto');









///////////////////////////////////////// TODO /////////////////////////////////////////


var scrollShadow = (function() {
    var elem, width, height, offset,
      shadowTop, shadowBottom,
      timeout;
  
    function initShadows() {
        shadowTop = $("<div>")
            .addClass("shadow-top")
            .insertAfter(elem);
        shadowBottom = $("<div>")
            .addClass("shadow-bottom")
            .insertAfter(elem);
    }
  
    function calcPosition() {
        width = elem.outerWidth();
        height = elem.outerHeight();
        offset = elem.position();
    
        // update 
        shadowTop.css({
            width: width + "px",
            top: offset.top + "px",
            left: offset.left + "px"
        });
        shadowBottom.css({
            width: width + "px",
            top: (offset.top + height - 20) + "px",
            left: offset.left + "px"
        });
    }
  
    function addScrollListener() {
        elem.off("scroll.shadow");
        elem.on("scroll.shadow", function() {
            if (elem.scrollTop() > 0) {
                shadowTop.fadeIn(125);
            } else {
                shadowTop.fadeOut(125);
            }

            if (elem.scrollTop() + height >= elem[0].scrollHeight) {
                shadowBottom.fadeOut(125);
            } else {
                shadowBottom.fadeIn(125);
            }
        });
    }
  
    function addResizeListener() {
        $(window).on("resize.shadow", function() {
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                calcPosition();
                elem.trigger("scroll.shadow");
            }, 10);
        });
    }

    return {
        init: function(par) {
            elem = $(par);
            initShadows();
            calcPosition();
            addScrollListener();
            addResizeListener();
            elem.trigger("scroll.shadow");
            calcPosition();
        },
        update: calcPosition
    };
}());

scrollShadow.init(".scroll-shadows");
