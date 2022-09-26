'use strict';


query_api('projects/', {}, function(data)
{
    let html = '';

    data= data.concat(data);
    data= data.concat(data);

    for (const project of data)
    {
        html += `
            <project-card>
                <project-preview></project-preview>
                <project-info>
                    <h2 data-project-id="${project.id}">${project.name}</h2>
                    <span class="small">
                        Created by <b>${project.creator}</b> on ${project.created},
                        last modified on ${project.modified}
                        <br/>
                    </span>
                </project-info>
                <project-progress>
                    [TODO : number of tasks]<br/>
                    [TODO : number of images]<br/>
                    [TODO : number of annotations]<br/>
                    [TODO : number of labels]
                </project-progress>
                <project-actions>
                    <button>Open</button>
                    <button>...</button>
                </project-actions>
            </project-card>
        `;
    }

    $('#project-count').text(data.length);
    $('project-list').html(html);
}, function(error_msg)
{
    $('project-list').html(`
        <project-card class="error">
            ${error_msg}
        </project-card>
    `);
});


