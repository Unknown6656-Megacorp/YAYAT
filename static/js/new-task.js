'use strict';



function add_files(file)
{
    const id = uuid();
    const element = $(`
        <file-element file-id="${id}">
            ${file}
            <button>Up</button>
            <button>Down</button>
            <button>Remove</button>
        </file-element>
    `);

    $('file-list').append(element);

    return element;
}



const server_path = $('#server-path');

$('#server-up').click(() =>
{
    server_path.val(server_path.val() + '..');

    $('#server-go').click();
});
$('#server-go').click(() => query_api_sync(
    'filesystem',
    { dir: server_path.val() },
    function(data)
    {
        server_path.val(data.dir);

        let html = '';

        for (const file of data.files)
            html += `
                <tr data-path="${file.path}" data-type="${file.type}">
                    <td>${file.name}</td>
                    <td>${file.size}</td>
                    <td>${print_relative_utc(file.created)}</td>
                    <td>${print_relative_utc(file.modified)}</td>
                </tr>
            `;

        $('#server-file-list').html(html);
    },
    function(error)
    {

    }
));






