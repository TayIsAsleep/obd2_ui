import re
import os
import obd
import json
import logging
import platform
from zipfile import ZipFile, ZIP_DEFLATED
from datetime import datetime
from flask import Flask
from flask import render_template
from flask import jsonify
from flask import request
from flask import Markup

def load_json_filter(fn):
    """
    Loads json file, even if it contains "illegal" comments.
    """
    with open(fn) as f:
        s = f.read()
        comments = [x[0] for x in re.findall('(?=\/\*)((.|\\n)*?)(?<=\*\/)', s)] + \
                   re.findall('((?=\/\/).*)', s)
        for comment in comments:
            s = s.replace(comment, "", 1)
        return json.loads(s)

def send_OBD_query(command_name):
    """
    Sends query to OBD. Returns `None` if command is incompatable, or if something goes wrong\n
    If query is compatable and it returns a value, it returns the "magnitude" value (raw python datatype)
    """

    global obd_connection
    cmd = obd.commands[command_name]
    if obd.commands.has_command(cmd):
        response = obd_connection.query(cmd)
        return None if response.is_null() else response.value.magnitude
    else:
        return None

if __name__ == "__main__":
    # Setup logging
    logging_output_fn = "./logs/" + datetime.now().strftime("%H:%M:%S %d-%m-%Y") + '.log'

    try:os.makedirs("./logs")
    except FileExistsError:
        os.chdir("./logs")
        for logfile_path in os.listdir("."):
            if logfile_path.endswith(".log"):
                zipfile_path = os.path.splitext(logfile_path)[0] + ".zip"
                if os.path.isfile(logfile_path) and not os.path.isfile(zipfile_path):
                    with ZipFile(zipfile_path, 'w', compression=ZIP_DEFLATED, compresslevel=9) as zip:
                        zip.write(logfile_path)
                    os.remove(logfile_path)
        os.chdir("../")

    print = logging.info
    logging.basicConfig(
        filename= logging_output_fn,
        filemode='w',
        encoding='utf-8',
        format="%(asctime)s [%(levelname)s] %(message)s",
        level=logging.DEBUG
    )
    logging.getLogger().addHandler(logging.StreamHandler())
    obd.logger.removeHandler(obd.console_handler)

    # Load settings
    settings = load_json_filter("settings.json")

    # Load gauges_data
    gauge_data = load_json_filter("gauges.json")
    gauge_data = {x: gauge_data[x] for x in gauge_data if gauge_data[x]['enabled']}
    obd_name_lookup = {gauge_data[x]["OBD_name"]: x for x in gauge_data}

    # Start OBD
    obd.logger.setLevel(obd.logging.DEBUG)
    obd_connection = obd.OBD(
        portstr       = settings['OBD_portstr'],
        baudrate      = settings['OBD_baudrate'],
        protocol      = settings['OBD_protocol'],
        fast          = settings['OBD_fast'],
        timeout       = settings['OBD_timeout'],
        check_voltage = settings['OBD_check_voltage']
    )

    # Start Flask
    app = Flask(__name__)

    def get_obd_info():
        return {
            "obd_status": obd_connection.status(),
            "port_name": obd_connection.port_name(),
            "protocol_name": obd_connection.protocol_name()
        }

    @app.route("/log")
    def route_log():
        with open(logging_output_fn, "r", encoding="utf-8") as f:
            return Markup(f"<pre>{logging_output_fn}</pre><pre>{f.read()}</pre>")

    @app.route("/")
    @app.route("/dashboard")
    def dashboard():
        return render_template(
            template_name_or_list = "dashboard.html",
            gauge_data            = gauge_data,
            data_to_request       = {x: gauge_data[x]["OBD_name"] for x in gauge_data}
        )
    
    @app.route("/OBD/fetch", methods=['GET','POST'])
    def api_fetch_data():
        requested_data = dict(request.form)

        data_to_return = {}
        for v_name in requested_data:
            data_to_return[v_name] = send_OBD_query(requested_data[v_name])
        
        return jsonify({
            "status": "OK",
            "obd_info": get_obd_info(),
            "data": data_to_return
        })
    
    @app.route("/OBD/cmd/<cmd_name>")
    def api_cmd(cmd_name):
        return jsonify({
            "status": "OK",
            "obd_info": get_obd_info(),
            "data": send_OBD_query(cmd_name)
        })

    app.run(
        host         = settings['flask_host'],
        port         = settings['flask_port'][1 if platform.uname().node == "rbp" else 0],
        debug        = settings['flask_debug_mode'],
        use_reloader = False
    )