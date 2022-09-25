'use strict';


function compute_hash(uname, passwd)
{
    return sha512(sha512(uname + passwd) + uname);
}


$('#login-form').submit(function(event)
{
    event.preventDefault();

    const uname = $('#login-username').val();
    const passw = $('#login-password').val();
    const phash = compute_hash(uname, passw);

    query_api('login', {
        'uname': uname,
        'phash': phash,
    }, function(data)
    {
        window.location.pathname = '/';
    }, msg => $('#login-error').text(msg));
});
