import re
import obd
import json
from flask import Flask
from flask import render_template
from flask import redirect
from flask import jsonify
from flask import request

def send_OBD_query(command_name):
    global demo_i, demo
    if demo:
        if demo_i[0] >= 1:
            demo_i[1] = False
        if demo_i[0] <= 0:
            demo_i[1] = True
        demo_i[0] += 0.01 * (1 if demo_i[1] else -1)
        return round(demo_i[0] * gauge_data[obd_name_lookup[command_name]]['max'])

    global obd_connection
    cmd = obd.commands[command_name]
    if obd.commands.has_command(cmd):
        response = obd_connection.query(cmd)
        return None if response.is_null() else response.value.magnitude
    else:
        return None

if __name__ == "__main__":
    # Load settings
    with open('settings.json') as f:
        settings_string = f.read()
        comments = re.findall('(?=\/\*).*(?<=\*\/)', settings_string) + \
                   re.findall('((?=\/\/).*)', settings_string)
        for comment in comments:
            settings_string = settings_string.replace(comment, "", 1)
        settings = json.loads(settings_string)

    # Load gauges_data
    with open('gauges.json') as f:
        gauge_data = json.load(f)
        obd_name_lookup = {gauge_data[x]["OBD_name"]: x for x in gauge_data}

    # Set DEMO settings
    demo = settings['demo_mode']
    demo_i = [0, True]

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

    @app.route("/")
    def index():
        return redirect("/dashboard")
        
    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")

    @app.route("/get_gauge_data")
    def get_gauge_data():
        return jsonify(gauge_data)
    
    @app.route("/OBD/fetch", methods=['GET','POST'])
    def api_fetch_data():
        requested_data = dict(request.form)

        data_to_return = {}
        for v_name in requested_data:
            data_to_return[v_name] = send_OBD_query(requested_data[v_name])
        
        return jsonify({
            "status": "OK",
            "obd_info": {
                "obd_status": obd_connection.status(),
                "port_name": obd_connection.port_name(),
                "protocol_name": obd_connection.protocol_name()
            },
            "data": data_to_return
        })

    app.run(
        host         = settings['host'],
        port         = settings['port'],
        debug        = settings['flask_debug_mode'],
        use_reloader = False
    )