'use strict';


function query_api(path, obj, sucess, error)
{
    path = `/api/${path}?`

    for (const key in obj)
        path += `&${key}=${obj[key]}`;

    $.getJSON(path, data => sucess(data.response))
    .fail(data => error(data.responseJSON.error));
}
