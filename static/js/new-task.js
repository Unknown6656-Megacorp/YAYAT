'use strict';


const FILE_TYPE = {
    SERVER: 's',
    UPLOAD: 'u',
    WEBURL: 'w',
}
let files = []
const web_url = $('#web-url');
const web_submit = $('#web-submit');
const server_path = $('#server-path');
const server_go = $('#server-go');
const file_input = $('#file-input');
const file_drop_area = $('file-drop-area');
const FILE_UPLOAD_KEY = 'file[]'
const server_history = [];
const form_data = new FormData();


function update_file_list()
{
    const existing_file_entries = form_data.getAll(FILE_UPLOAD_KEY);
    const new_file_entries = [];
    let html = '';

    for (let i in files)
    {
        const file = files[i];
        const prefix = file.type === FILE_TYPE.UPLOAD ? `${file.uuid.slice(0, 8)}:/` : '';

        html += `
            <file-element data-index="${i}" data-path="${file.file}" data-type="${file.type}" data-uuid="${file.uuid}">
                <input type="text" class="file-name" value="${prefix}${file.file}" readonly/>
                <button class="file-up" ${i == 0 ? 'disabled' : ''}></button>
                <button class="file-down" ${i == files.length - 1 ? 'disabled' : ''}></button>
                <button class="file-remove"></button>
            </file-element>
        `;

        if (file.uuid != undefined)
        {
            i = existing_file_entries.findIndex(e => e['uuid'] == file.uuid);
            new_file_entries.push(existing_file_entries[i]);
        }
    }

    form_data.delete(FILE_UPLOAD_KEY);
    new_file_entries.forEach(f => form_data.append(FILE_UPLOAD_KEY, f));

    $('file-list').html(html);
    $('#files-count').text(files.length);
    $('.file-up').click(e => {
        const index = parseInt($(e.target).parent().attr('data-index'));

        if (index > 0)
        {
            const tmp = files[index - 1];

            files[index - 1] = files[index];
            files[index] = tmp;

            update_file_list();
        }
    });
    $('.file-down').click(e => {
        const index = parseInt($(e.target).parent().attr('data-index'));

        if (index < files.length - 1)
        {
            const tmp = files[index + 1];

            files[index + 1] = files[index];
            files[index] = tmp;

            update_file_list();
        }
    });
    $('.file-remove').click(e => remove_file_by_uuid($(e.target).parent().attr('data-uuid')));
}

function has_file(file, type = undefined)
{
    if (type !== FILE_TYPE.UPLOAD)
        for (const f of files)
            if (f.file == file && (f.type === (type || f.type)))
                return true;

    return false;
}

function add_file(file, type, silent = false)
{
    if (!has_file(file, type))
    {
        const uid = uuid();

        files.push({ file: file, type: type, uuid: uid });

        if (!silent)
            update_file_list();

        return uid;
    }
    else
        return undefined;
}

function remove_file(file, type = undefined, silent = false)
{
    files = files.filter(f => !(f.file == file && (f.type === (type || f.type))));

    if (!silent)
        update_file_list();
}

function remove_file_by_uuid(uuid)
{
    files = files.filter(f => f.uuid != uuid);

    update_file_list();
}

function server_navigate_to(path)
{
    server_path.val(path);
    server_go.click();
}


web_url.on('change paste keyup', () =>
{
    const url = web_url.val().trim();

    web_submit.prop('disabled', url.length == 0);
}).change();
web_submit.click(() =>
{
    add_file(web_url.val().trim(), FILE_TYPE.WEBURL);

    web_url.val('').change();
});

$('#server-up').click(() => server_navigate_to(server_path.val() + '/..'));
server_path.on('keyup', e =>
{
    if (e.key === 'Enter' || e.keyCode === 13)
        server_go.click();
});
server_go.click(() =>
{
    const orig = server_path.attr('data-path') || '/';

    query_api_sync(
        'filesystem',
        { dir: server_path.val() },
        function(data)
        {
            server_path.val(data.dir);
            server_path.attr('data-path', data.dir);

            let html = '';

            for (const file of data.files)
                html += `
                    <tr data-path="${file.path}" data-type="${file.type}">
                        <td class="file-tick">
                            <input type="checkbox" ${has_file(file.path, FILE_TYPE.SERVER) ? 'checked' : ''}/>
                        </td>
                        <td class="file-name">${file.name}</td>
                        <td class="file-size">${file.size}</td>
                        <td class="file-created">${print_absolute_utc(file.created)}</td>
                        <td class="file-modified">${print_absolute_utc(file.modified)}</td>
                    </tr>
                `;

            $('#server-file-list').html(html);
            $('#server-file-list').scrollTop(0);
            $('#server-file-list tr[data-type="d"] td.file-name').click(e =>
            {
                const path = $(e.target).parent().attr('data-path');

                server_navigate_to(path);
            });
            $('#server-file-list tr td.file-tick input').change(e =>
            {
                const checkbox = $(e.target);
                const checked = checkbox.is(':checked')
                const path = checkbox.parents('tr').attr('data-path');

                if (checked)
                    add_file(path, FILE_TYPE.SERVER);
                else
                    remove_file(path, FILE_TYPE.SERVER);
            });
        },
        function(error)
        {
            server_navigate_to(orig);
        }
    );
});

server_navigate_to('/..');



$('html').on('dragover drop', e =>
{
    e.preventDefault();
    e.stopPropagation();
});
$('html').on('dragover', e =>
{
    // TODO : highlight file_drop_area
});


function add_upload_files(files)
{
    for (const file of files)
    {
        const uuid = add_file(file.name, FILE_TYPE.UPLOAD, true);

        file['uuid'] = uuid;
        form_data.append(FILE_UPLOAD_KEY, file);
    }

    update_file_list();
}

file_drop_area.on('dragover drop', e =>
{
    e.stopPropagation();
    e.preventDefault();
});

file_drop_area.on('drop', e =>
{
    // TODO : stop highlighting file_drop_area

    add_upload_files(e.originalEvent.dataTransfer.files);
});

$('#upload-files').click(() => file_input.click());

file_drop_area.click(() => file_input.click());

file_input.change(() => add_upload_files(file_input[0].files));






function upload_form_data(path, success, error)
{
    $.ajax({
        url: `/api/${path}`,
        data: form_data,
        type: 'POST',
        dataType: 'multipart/form-data',
        cache: false,
        contentType: false,
        processData: false,
        success: d => success(d.response),
        error: e => error(e.responseJSON?.error || e.statusText || '[Unknown Error]'),
    });
}





$('#btn-create').click(() =>
{
    query_api(`projects/${project.id}`)

    const name = $('#task-name').val();

    form_data.set('name', name);
    form_data.delete('footage[]');

    files.forEach(f => form_data.append('footage[]', JSON.stringify(f)));

    upload_form_data('echo', console.log, console.log);
})






