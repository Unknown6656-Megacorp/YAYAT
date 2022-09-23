from flask import Flask, request, send_from_directory
import argparse


MAIN_FOLDER = '/yayat/'




app = Flask(__name__)

@app.route('/')
def route_root():
    return f'''<!DOCTYPE HTML>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="refresh" content="0; url={MAIN_FOLDER}">
                <script type="text/javascript">
                    window.location.href = "{MAIN_FOLDER}"
                </script>
                <title>Page Redirection</title>
            </head>
            <body>
                If you are not redirected automatically, follow <a href='{MAIN_FOLDER}'>this link</a>.
            </body>
        </html>
    '''

@app.route(f'{MAIN_FOLDER}')
def route_index():
    return send_from_directory('static', 'index.html')

@app.route(f'{MAIN_FOLDER}<path:path>')
def route_static(path : str = ''):
    return send_from_directory('static', path)






parser = argparse.ArgumentParser()
parser.add_argument('--port', '-p', type = str, default = '42420', help = 'The listening port.')
parser.add_argument('--hostname', '-n', type = str, default = '0.0.0.0', help = 'The host name.')
parser.add_argument('--debug', '-d', type = bool, default = True, help = 'Runs the server in debug mode.')
args = parser.parse_args()

app.run(args.hostname, int(args.port), bool(args.debug))
