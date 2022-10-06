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

            $('server-navigator progress-spinner').remove();
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
                const is_dir = checkbox.parents('tr').attr('data-type') == 'd';

                if (checked)
                {
                    if (is_dir)
                        show_modal_notice(
                            'Do you want to add the entire directory?',
                            `<p>
                                You are about to add an entire directory to the file upload list.
                                This results in every file inside the directory to be processed.
                                This may take a VERY long time. Are you sure that you want to proceed?
                            </p>
                            The directory in question is <b>${path}</b>.
                            `, [
                                ['Yes', () => add_file(path, FILE_TYPE.SERVER)],
                                ['No', () => checkbox.prop('checked', false)]
                            ]
                        );
                    else
                        add_file(path, FILE_TYPE.SERVER);
                }
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


$('#btn-cancel').click(() => window.location.href = base_uri);
$('#btn-upload').click(() =>
{
    show_modal_notice(
        'Task creation is in progress...',
        `<p>
            Please hang on while we create your task.
            This process may take multiple minutes depending on the amount of footage added.
        </p>
        <p>
            Did you know that this process is more complex than I imagined?
            In order to create a new task, one has first to transmit all the data back to the server
            (an absolute clusterfuck-nightmare involving multipart data forms), then the server has to create a temporary folder into which all input files are stored.
            The server then processes each file using FFMPEG, extracting the image frames in the process.
            Each frame is then normalized and stored into the task's newly created directory.
            Finally, before cleaning up the created mess, a preview image has to be created for each frame in the project.
        </p>
        <p>
            So yeah, that's why it's taking so long. Feel free to grab a cup of coffee.
        </p>
        <p>
            Alternatively, you can stare mesmerized at the following non-descriptive progress spinner and enjoy the update messages delivered to you via a wonky websocket-connection:
        </p>
        <progress-spinner></progress-spinner>
        <p id="progress-updates">
        </p>
        `,
        []
    );

    let timer = setInterval(() => query_api_sync(`projects/${project_id}/tasks/${task_id}/upload/progress`, { },
        data =>
        {
            $('#progress-updates').text(data.at(-1));
        },
        error => clearInterval(timer)
    ), 500);
    const form_data_final = new FormData();

    form_data_final.set('files', JSON.stringify(files));
    form_data.getAll(FILE_UPLOAD_KEY)
             .forEach(f => form_data_final.append(f['uuid'], f));

    $.ajax({
        url: `/api/projects/${project_id}/tasks/${task_id}/upload`,
        data: form_data_final,
        type: 'POST',
        dataType: 'json',
        cache: false,
        contentType: false,
        processData: false,
        success: d =>
        {
            clearInterval(timer);
            hide_modal_notice();

            window.location.href = base_uri;
        },
        error: e =>
        {
            clearInterval(timer);
            show_modal_notice(
                'An error occurred',
                e.responseJSON?.error || e.statusText || '[Unknown Error]',
                [['Ok', () => { }]]
            );
        },
    });
});
