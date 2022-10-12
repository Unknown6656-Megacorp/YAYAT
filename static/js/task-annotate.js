'use strict';


const current_frame = {
    number: 0,
    width: 0,
    height: 0,
    minzoom: .5,
    maxzoom: 10,
    canvas: null,
    canvas_ctx: null,
};

const zoom_slider = $('#zoom-slider');
const pan_container = $('annotation-canvas');
const pan_controls = $('panzoom-controls');
const pan_canvas = $('svg-holder');

pan_container.on('resize', on_panzoom_changed);
pan_container.on('dblclick', reset_pos_zoom);

$(document).on('mousemove wheel', on_panzoom_mouse_moved)

let pz = undefined;


function update_panzoom()
{
    if (pz)
        pz.dispose();

    const size = Math.max(current_frame.width, current_frame.height);

    pz = panzoom(pan_canvas[0], {
        zoomSpeed: .5,
        smoothScroll: true,
        maxZoom: (current_frame.maxzoom = 27000.0 / size),
        minZoom: current_frame.minzoom,
        bounds: true,
        boundsPadding: .4,
        zoomDoubleClickSpeed: 1,
        transformOrigin: {x: 0.5, y: 0.5},
        onDoubleClick: event => {
            return false;
        },
        beforeMouseDown: should_ignore_panzoom,
        beforeWheel: should_ignore_panzoom,
    });
    pz.on('pan', on_panzoom_changed);
    pz.on('zoom', on_panzoom_changed);

    on_panzoom_changed();
    reset_pos_zoom();
}

function on_panzoom_changed()
{
    if (current_frame.width == 0 || current_frame.height == 0)
    {
        $('#pan-window-svg').hide();

        return;
    }
    else
        $('#pan-window-svg').show();

    const { x, y, scale } = pz.getTransform();
    const scaled_frame = {
        w: scale * current_frame.width,
        h: scale * current_frame.height,
    };
    const canvas_bounds = pan_container[0].getBoundingClientRect();
    const canvas = {
        w: canvas_bounds.width,
        h: canvas_bounds.height
    };

    let c_height, c_width,
        f_height, f_width,
        svg_height, svg_mode,
        c_x = 0, c_y = 0,
        f_x = 0, f_y = 0,

        first_x, first_y,
        last_x, last_y;
    const svg_width = 120.0;

    if (canvas.w > scaled_frame.w || canvas.h > scaled_frame.h)
    {
        const relative_scale = scaled_frame.w / canvas.w;

        c_width = svg_width;
        c_height =
        svg_height = canvas.h / canvas.w * svg_width;
        f_width = svg_width * relative_scale;
        f_height = scaled_frame.h / scaled_frame.w * f_width;
        f_x = x / canvas.w * svg_width;
        f_y = y / canvas.h * svg_height;
        svg_mode = 'zoom-out';
    }
    else
    {
        const relative_scale = canvas.w / scaled_frame.w;

        f_width = svg_width;
        f_height =
        svg_height = scaled_frame.h / scaled_frame.w * svg_width;
        c_width = svg_width * relative_scale;
        c_height = canvas.h / canvas.w * c_width;
        c_x = -x / scaled_frame.w * svg_width;
        c_y = -y / scaled_frame.h * svg_height;
        svg_mode = 'zoom-in';
    }

    zoom_slider.attr({
        min: current_frame.minzoom * 100,
        max: current_frame.maxzoom * 100,
    }).val(100 * scale);
    $('#pan-window-svg').css({
        width: `${svg_width}px`,
        height: `${svg_height}px`,
    }).attr('class', svg_mode);
    $('#pan-window-svg-image, #pan-window-svg-overlay').attr({
        x: f_x,
        y: f_y,
        width: f_width,
        height: f_height,
    });
    $('#pan-window-svg-client').attr({
        x: c_x,
        y: c_y,
        width: c_width,
        height: c_height,
    });
    $('#zoom-level').text(`${(100 * scale).toFixed(2)} %`);
}

function on_panzoom_mouse_moved(event)
{
    const widget = $('cursor-info-widget');

    if (pan_canvas.has(event.target).length && current_frame.canvas_ctx)
    {
        const X = event.offsetX;
        const Y = event.offsetY;
        const rgba = current_frame.canvas_ctx.getImageData(X, Y, 1, 1).data;
        const color = '#' + hex2(rgba[0]) + hex2(rgba[1]) + hex2(rgba[2]) + hex2(rgba[3]);

        $('#cursor-position').html(`
            ${X} &nbsp;|&nbsp; ${Y}<br/>
            ${color}
        `);
        $('#cursor-color').css('background-color', color);

        widget.removeClass('hidden');
    }
    else
        widget.addClass('hidden');
}

function should_ignore_panzoom()
{
    const hovered_on = $(':hover');

    return pan_controls.find(hovered_on).length > 0;
}

function reset_pos_zoom()
{
    if (!pz)
        return;

    const cnv = pan_container[0].getBoundingClientRect();
    const zoom = Math.min(1.0 * cnv.width / current_frame.width, 1.0 * cnv.height / current_frame.height);

    pz.zoomAbs(0, 0, zoom);
    pz.moveTo(
        (cnv.width - zoom * current_frame.width) / 2,
        (cnv.height - zoom * current_frame.height) / 2
    );
}

$(window).resize(on_panzoom_changed);

update_panzoom();
// pixelated
// smooth

zoom_slider.change(function()
{
    if (pz)
        pz.zoomAbs(0, 0, zoom_slider.val());
});


$('#btn-first-frame').click(() => goto_frame(0));
$('#btn-prev-frame').click(() => goto_frame(current_frame.number - 1));
$('#btn-next-frame').click(() => goto_frame(current_frame.number + 1));
$('#btn-last-frame').click(() => goto_frame(task.frames.length - 1));
$('#frame-slider, #frame-number').on('change input paste', e => goto_frame($(e.target).val() - 1));
$('#btn-play-backward');
$('#btn-play-forward');

function goto_frame(frame_number)
{
    frame_number = Math.max(0, Math.min(frame_number, task.frames.length));

    const frame = task.frames[frame_number];

    current_frame.number = frame_number;
    current_frame.width = frame.width;
    current_frame.height = frame.height;

    const img_url = `/api/img/${task.project}/${task.id}/${frame.id}`;
    let svg = '';

    for (const expl_annotation in frame.explicit_annotations)
    {
        svg += `
            <g>
                <!-- add rectangle, circles, and grabber -->
            </g>
        `;
    }

    $('#svg-annotations').html(svg);
    $('svg-holder, #svg-root').css('width', `${frame.width}px`).css('height', `${frame.height}px`);
    $('#svg-root').attr('viewBox', `0 0 ${frame.width} ${frame.height}`);
    $('#svg-image, #pan-window-svg-image').attr('href', img_url);
    $('#frame-resolution').text(`${frame.width} x ${frame.height} `);
    $('#frame-source').attr('data-source', frame.original_image_source);
    $('#frame-internal-name').text(frame.local_image_filename);
    $('#frame-original-name').text(frame.original_image_filename);
    $('#frame-slider, #frame-number').val(frame_number + 1);
    $('#btn-first-frame, #btn-prev-frame, #btn-play-backward').attr('disabled', frame_number < 1);
    $('#btn-last-frame, #btn-next-frame, #btn-play-forward').attr('disabled', frame_number > task.frames.length - 2);

    update_panzoom();

    window.history.replaceState(null, null, `#${frame_number + 1}`);
}

document.getElementById('svg-image').onload = function()
{
    current_frame.canvas = document.createElement('canvas');
    current_frame.canvas.width = current_frame.width;
    current_frame.canvas.height = current_frame.height;
    current_frame.canvas_ctx = current_frame.canvas.getContext('2d');
    current_frame.canvas_ctx.drawImage(document.getElementById('svg-image'), 0, 0);
};











const hash = parseInt(window.location.hash.slice(1));

if (hash > 0 && hash <= task.frames.length)
    goto_frame(hash - 1);
