'use strict';


$('#btn-create').click(() => query_api_sync(
    `projects/${project_id}/tasks/create`,
    { name: $('#task-name').val() },
    data => {
        window.location.href = `/yayat/projects/${project_id}/tasks/${data.id}/`
    },
    error => show_modal_notice('An error occurred', error, [['Ok', () => { }]])
));
$('#btn-cancel').click(() => window.location.href = `/yayat/projects/${project_id}/`);
