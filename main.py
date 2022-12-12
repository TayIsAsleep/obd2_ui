from flask import Flask
from flask import render_template
from flask import redirect
from flask import jsonify
from flask import request
import obd
import json

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
    response = obd_connection.query(cmd)
    if response.is_null():
        return None
    else:
        return response.value.magnitude

if __name__ == "__main__":
    obd.logger.setLevel(obd.logging.DEBUG)

    with open('gauges.json') as f:
        gauge_data = json.load(f)
        obd_name_lookup = {gauge_data[x]["OBD_name"]: x for x in gauge_data}

    demo = True
    demo_i = [0, True]

    # Start
    obd_connection = obd.OBD(timeout=0)
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
        
        print("Requested data:", requested_data)

        data_to_return = {}
        for v_name in requested_data:
            data_to_return[v_name] = send_OBD_query(requested_data[v_name])
        
        return jsonify({
            "status": "OK",
            "obd_status": obd_connection.status(),
            "data": data_to_return
        })

    app.run(host="0.0.0.0", use_reloader=False)