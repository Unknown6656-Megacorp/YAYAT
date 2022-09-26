'use strict';

const TASK_PROGRESS = {
    NOT_YET_STARTED: 0,
    IN_PROGRESS: 1,
    COMPLETED: 2,
};


async function query_api(path, obj, error)
{
    path = `/api/${path}?`

    for (const key in obj)
        path += `&${key}=${obj[key]}`;

    try
    {
        const result = await $.ajax({
            url: path,
            data: { },
            type: 'GET',
            dataType: 'json'
        });

        return result.response;
    }
    catch (err)
    {
        error(err.responseJSON.error);

        return undefined;
    }
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

