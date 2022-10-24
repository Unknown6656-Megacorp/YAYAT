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
const MOUSE_MODES = {
    REGULAR: 0,
    BBOX_FIRST_CORNER: 1,
    BBOX_SECOND_CORNER: 2,
};


let mouse_mode = MOUSE_MODES.REGULAR;
let annotation_first_point = undefined;

const zoom_slider = $('#zoom-slider');
const pan_container = $('annotation-canvas');
const pan_controls = $('panzoom-controls');
const pan_canvas = $('svg-content');
const svg_overlay = $('svg-overlay');

pan_container.on('resize', on_panzoom_changed);
pan_container.on('dblclick', reset_pos_zoom);

$(document).on('mousemove wheel', on_panzoom_mouse_moved)

let pz = undefined;


function update_panzoom()
{
    if (pz)
        pz.dispose();

    current_frame.maxzoom = 30000.0 / Math.max(current_frame.width, current_frame.height);
    pz = panzoom(pan_canvas[0], {
        zoomSpeed: .5,
        smoothScroll: true,
        maxZoom: current_frame.maxzoom,
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

    display_annotations();
}

function get_mouse_xy_pixel(event, allow_out_of_bounds = false)
{
    let s, x, y;
    [s, , , , x, y] = pan_canvas.css('transform')
                                .replace(')', '')
                                .replace('matrix(', '')
                                .split(',')
                                .map(parseFloat);

    const bounds = pan_container[0].getBoundingClientRect();
    const w = current_frame.width;
    const h = current_frame.height;
    const px = (event.pageX - bounds.left - x) / s;
    const py = (event.pageY - bounds.top - y) / s;
    const outside = px < 0 || py < 0 || px >= w || py >= h;

    if (!allow_out_of_bounds && outside)
        return { x: undefined, y: undefined, outside: outside };
    else
        return { x: px, y: py, outside: outside };
        // return { x: event.offsetX, y: event.offsetY };
}

function pixel_to_svg_space(xy)
{
    let s, x, y;
    [s, , , , x, y] = pan_canvas.css('transform')
                                .replace(')', '')
                                .replace('matrix(', '')
                                .split(',')
                                .map(parseFloat);

    return {
        x: s * xy.x + x,
        y: s * xy.y + y,
    };
}

function on_panzoom_mouse_moved(event)
{
    const widget = $('cursor-info-widget');
    const { x: X, y: Y, outside } = get_mouse_xy_pixel(event, true);

    if (outside || current_frame.canvas_ctx == null)
        widget.addClass('hidden');
    else
    {
        const rgba = current_frame.canvas_ctx.getImageData(X, Y, 1, 1,).data;
        const color = '#' + hex2(rgba[0]) + hex2(rgba[1]) + hex2(rgba[2]) + hex2(rgba[3]);

        $('#cursor-position').html(`
            ${round_to(X, 1)} | ${round_to(Y, 1)}<br/>
            ${color}
        `);
        $('#cursor-color').css('background-color', color);

        widget.removeClass('hidden');
    }

    if (mouse_mode == MOUSE_MODES.REGULAR)
        pan_container.removeClass('annotating');
    else
    {
        const { x: cX, y: cY } = get_cursor_relative_to_element(event, svg_overlay);
        const bounds = svg_overlay[0].getBoundingClientRect();

        $('#svg-cursor-x').attr({ x1: cX, x2: cX, y1: 0, y2: bounds.height });
        $('#svg-cursor-y').attr({ x1: 0, x2: bounds.width, y1: cY, y2: cY });
        pan_container.addClass('annotating');
    }

    if (mouse_mode == MOUSE_MODES.BBOX_SECOND_CORNER && annotation_first_point != undefined)
    {
        const first = pixel_to_svg_space(annotation_first_point);
        const label = labels.filter(l => l.id == $('#new-annotation-type').val())[0];
        let second = {x: X, y: Y};

        second.x = Math.max(0, Math.min(second.x, current_frame.width));
        second.y = Math.max(0, Math.min(second.y, current_frame.height));
        second = pixel_to_svg_space(second);

        $('#svg-current-annotation').attr({
            x: Math.min(first.x, second.x),
            y: Math.min(first.y, second.y),
            width: Math.abs(first.x - second.x),
            height: Math.abs(first.y - second.y),
        }).css({
            stroke: label.color,
            fill: label.color + '50',
        });
    }
}

function should_ignore_panzoom()
{
    const hovered_on = $(':hover');

    return pan_controls.find(hovered_on).length > 0;
}

function canvas_clicked(event)
{
    if (mouse_mode == MOUSE_MODES.BBOX_FIRST_CORNER)
    {
        annotation_first_point = get_mouse_xy_pixel(event, true);
        annotation_first_point.x = Math.max(0, Math.min(annotation_first_point.x, current_frame.width));
        annotation_first_point.y = Math.max(0, Math.min(annotation_first_point.y, current_frame.height));
        mouse_mode = MOUSE_MODES.BBOX_SECOND_CORNER;
    }
    else if (mouse_mode == MOUSE_MODES.BBOX_SECOND_CORNER)
    {
        const second_point = get_mouse_xy_pixel(event, true);

        if (second_point.x == annotation_first_point.x && second_point.y == annotation_first_point.y)
            return;

        second_point.x = Math.max(0, Math.min(second_point.x, current_frame.width));
        second_point.y = Math.max(0, Math.min(second_point.y, current_frame.height));

        const w = Math.abs(annotation_first_point.x - second_point.x);
        const h = Math.abs(annotation_first_point.y - second_point.y);
        const cx = Math.min(annotation_first_point.x, second_point.x) + w * .5;
        const cy = Math.min(annotation_first_point.y, second_point.y) + h * .5;

        if (w * h > 0)
            submit_annotation(
                $('#new-annotation-type').val(),
                cx / current_frame.width,
                cy / current_frame.height,
                w / current_frame.width,
                h / current_frame.height,
            );

        annotation_first_point = undefined;
        mouse_mode = MOUSE_MODES.REGULAR;

        $('#svg-current-annotation').attr({ x: 0, y: 0, width: 0, height: 0 });
    }
    else
        return;

    on_panzoom_mouse_moved(event);
    update_bbox_buttons();
}

function reset_pos_zoom(reset_pan = true)
{
    if (!pz)
        return;

    const cnv = pan_container[0].getBoundingClientRect();
    const zoom = Math.min(1.0 * cnv.width / current_frame.width, 1.0 * cnv.height / current_frame.height);

    pz.zoomAbs(0, 0, zoom);

    if (reset_pan)
        pz.moveTo(
            (cnv.width - zoom * current_frame.width) / 2,
            (cnv.height - zoom * current_frame.height) / 2
        );
}

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
    $('svg-content, #svg-root').css('width', `${frame.width}px`).css('height', `${frame.height}px`);
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

function update_bbox_buttons()
{
    $('#btn-new-bounding-box').attr('disabled', mouse_mode != MOUSE_MODES.REGULAR);
}

function submit_annotation(cls, cx, cy, w, h)
{
    query_api_sync(
        `projects/${task.project}/tasks/${task.id}/frames/${current_frame.number}/annotations/add`,
        {
            'label' : cls,
            'x' : cx,
            'y' : cy,
            'w' : w,
            'h' : h
        },
        data => {
            task.frames[current_frame.number].explicit_annotations = data;

            display_annotations();
        },
        error => console.error(error)
    );
}

function fetch_annotations()
{
    query_api_sync(
        `projects/${task.project}/tasks/${task.id}/frames/${current_frame.number}/annotations`,
        { },
        data => {
            task.frames[current_frame.number].explicit_annotations = data;

            display_annotations();
        },
        error => console.error(error)
    );
}

function display_annotations()
{
    let svg = '';

    for (const annotation of task.frames[current_frame.number].explicit_annotations)
    {
        let x1 = annotation.pose[0] * current_frame.width;
        let y1 = annotation.pose[1] * current_frame.height;
        let w = annotation.pose[2] * current_frame.width;
        let h = annotation.pose[3] * current_frame.height;

        x1 -= w * 0.5;
        y1 -= h * 0.5;

        let x2 = x1 + w;
        let y2 = y1 + h;

        let xy1 = pixel_to_svg_space({x:x1, y:y1})
        let xy2 = pixel_to_svg_space({x:x2, y:y2})

        x1=xy1.x;
        y1=xy1.y;

        x2=xy2.x;
        y2=xy2.y;

        svg += `
            <rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}"/>
        `;
    }

    $('#svg-annotations').html(svg);
}






document.getElementById('svg-image').onload = function()
{
    current_frame.canvas = document.createElement('canvas');
    current_frame.canvas.width = current_frame.width;
    current_frame.canvas.height = current_frame.height;
    current_frame.canvas_ctx = current_frame.canvas.getContext('2d', {
        willReadFrequently: true
    });
    current_frame.canvas_ctx.drawImage(document.getElementById('svg-image'), 0, 0);
};

pan_container.click(canvas_clicked);

$('#zoom-reset').click(() => reset_pos_zoom(false));
$('#pan-reset').click(() => reset_pos_zoom());

$(window).resize(on_panzoom_changed);

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

$('#btn-new-bounding-box').click(function()
{
    mouse_mode = MOUSE_MODES.BBOX_FIRST_CORNER;


    // TODO
    update_bbox_buttons();
});


{
    let html = '';

    for (const label of labels)
        html += `
            <option value="${label.id}">${escape_html(label.name)}</option>
        `;

    $('#new-annotation-type').html(html);
}

const hash = parseInt(window.location.hash.slice(1));

if (hash > 0 && hash <= task.frames.length)
    goto_frame(hash - 1);
else
    update_panzoom();