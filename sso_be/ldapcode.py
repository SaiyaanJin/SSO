import ldap
import jwt
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import json
import datetime
import json

app = Flask(__name__)

CORS(app)
logout_user = []


@app.route('/', methods=['GET', 'POST'])
def default():

    return jsonify("Wroking(200.63)")


@app.route('/emp_data', methods=['GET', 'POST'])
def emp_data():

    user_details = request.headers['Data']

    if user_details == "Sanju8@92":

        l = ldap.initialize("ldap://10.3.110.120")

        l.protocol_version = ldap.VERSION3

        l.set_option(ldap.OPT_REFERRALS, 0)

        bind = l.simple_bind_s("erldc\\administrator", "EradRT$A09")

        result = l.search_s('dc=erldc,dc=net', ldap.SCOPE_SUBTREE,
                            'userPrincipalName=*', [])

        final = []

        for item in result:
            if (item[0] != None and (item[1]['sAMAccountName'][0].decode("utf-8").isdigit() or item[1]['sAMAccountName'][0].decode("utf-8") in ['raju', 'pritam', 'code exchange', 'RTSD', 'schedule', 'shift-in-charge'])):

                try:
                    dct = {}
                    try:
                        dct["Name"] = item[1]['cn'][0].decode("utf-8")
                    except:
                        dct["Name"] = ""

                    try:
                        dct["Emp_id"] = item[1]['sAMAccountName'][0].decode(
                            "utf-8")

                    except:
                        dct["Emp_id"] = ""

                    try:
                        if ((item[1]['mail'][0].decode("utf-8")).split("@")[1] == "posoco.in"):
                            dct["Mail"] = (item[1]['mail'][0].decode(
                                "utf-8")).split("@")[0]+"@grid-india.in"

                        else:
                            dct["Mail"] = (item[1]['mail'][0].decode("utf-8"))
                    except:
                        dct["Mail"] = ""

                    try:
                        dct["Mobile"] = item[1]['telephoneNumber'][0].decode(
                            "utf-8")
                    except:
                        dct["Mobile"] = ""

                    try:
                        if (
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "IT-TS" or
                            (item[1]['distinguishedName'][0].decode(
                                "utf-8")).split(",")[1][3:] == "IT"
                        ):
                            dct["Department"] = "Information Technology (IT)"

                        elif (
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "MO" or
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "MO-I" or
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "MO-II" or
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "MO-III" or
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(
                                ",")[1][3:] == "MO-IV"
                        ):
                            dct["Department"] = "Market Operation (MO)"

                        elif (
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "MIS" or
                            (item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "SS" or

                            (item[1]['distinguishedName'][0].decode(
                                "utf-8")).split(",")[1][3:] == "SO"
                        ):
                            dct["Department"] = "System Operation (SO)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "CR"):
                            dct["Department"] = "Control Room (CR)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "SCADA"):
                            dct["Department"] = "SCADA"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "CS"):
                            dct["Department"] = "Contracts & Services (CS)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "TS"):
                            dct["Department"] = "Technical Services (TS)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "HR"):
                            dct["Department"] = "Human Resource (HR)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "COMMUNICATION"):
                            dct["Department"] = "Communication"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "F&A"):
                            dct["Department"] = "Finance & Accounts (F&A)"

                        elif ((item[1]['distinguishedName'][0].decode("utf-8")).split(",")[1][3:] == "CR"):
                            dct["Department"] = "Control Room (CR)"

                        else:
                            dct["Department"] = ".Others"

                    except:
                        dct["Department"] = "Others"

                    final.append(dct)

                except:

                    pass

        return jsonify(final)

    else:
        return jsonify("invalid request")


@app.route('/token', methods=['GET', 'POST'])
def token():

    global logout_user

    data = json.loads(request.data.decode('utf-8'))
    login_token = data['headers']['token']

    login_token = login_token.encode('utf-8')

    login_token_decoded = jwt.decode(
        login_token, 'frontendss0@posoco', algorithms=['HS256'])

    usr = login_token_decoded['username']

    if usr in logout_user:
        logout_user.remove(usr)

    pswd = login_token_decoded['password']

    l = ldap.initialize("ldap://10.3.110.120")

    l.protocol_version = ldap.VERSION3

    l.set_option(ldap.OPT_REFERRALS, 0)

    login = False

    try:

        current_time = datetime.datetime.now().__str__()

        dct = {"Login": True,
               "Token_Time": current_time,
               "User": usr
               }

        bind = l.simple_bind_s("erldc\\" + usr, pswd)

        result = l.search_s('dc=erldc,dc=net', ldap.SCOPE_SUBTREE,
                            'userPrincipalName='+usr+'@erldc.net', [])

        dct['Department'] = result[0][0].split(",")[1][3:]
        dct['Person_Name'] = result[0][0].split(",")[0][3:]

        encoded_jwt = jwt.encode(dct, 'it@posoco', algorithm='HS256')
        
        # encoded_jwt= encoded_jwt.decode("utf-8")

        response = jsonify({'Token': encoded_jwt})

        return response

    except Exception as e:
        

        current_time = datetime.datetime.now().__str__()

        dct = {"Login": False,
               "Token_Time": current_time,
               "User": usr
               }

        encoded_jwt = jwt.encode(dct, 'it@posoco', algorithm='HS256')
        
        # encoded_jwt= encoded_jwt.decode("utf-8")

        response = jsonify({'Token': encoded_jwt})

        return response


@app.route('/verify', methods=['GET', 'POST'])
def verify():

    global logout_user

    token = str(request.headers['Token'])
   
    try:
        token = token.encode("utf-8")
        
        decoded_jwt = jwt.decode(token, 'it@posoco', algorithms=['HS256'])
     

        if (decoded_jwt['Login']):

            times = str(decoded_jwt['Token_Time'])
            user = decoded_jwt['User']
            OU = decoded_jwt['Department']
            Person_Name = decoded_jwt['Person_Name']

            if user in logout_user:
                return jsonify('User has logout')

            current_time = datetime.datetime.now().__str__()
            current_time = current_time.split(' ')
            cur_date = current_time[0]
            cur_time = current_time[1]
            cur_time = cur_time.split(':')
            cur_time = cur_time[0]

            times = times.split(' ')
            token_date = times[0]
            token_time = times[1]
            token_time = token_time.split(':')
            token_time = token_time[0]

            if cur_date == token_date:
                if (int(cur_time) - int(token_time)) < 4:

                    encoded_jwt = jwt.encode(
                        {'Login': True, 'User': user, 'Department': OU, "Person_Name": Person_Name}, 'erldc1t@posoco', algorithm='HS256')

                    # encoded_jwt= encoded_jwt.decode("utf-8")

                    response = jsonify({'Final_Token': encoded_jwt})

                else:

                    encoded_jwt = jwt.encode(
                        {'Login': False, 'Reason': 'Session Expired'}, 'erldc1t@posoco', algorithm='HS256')

                    # encoded_jwt= encoded_jwt.decode("utf-8")

                    response = jsonify({'Final_Token': encoded_jwt})

            else:

                encoded_jwt = jwt.encode(
                    {'Login': False, 'Reason': 'Session Expired'}, 'erldc1t@posoco', algorithm='HS256')

                # encoded_jwt= encoded_jwt.decode("utf-8")

                response = jsonify({'Final_Token': encoded_jwt})

        else:

            encoded_jwt = jwt.encode(
                {'Login': False, 'Reason': 'Login Failed'}, 'erldc1t@posoco', algorithm='HS256')

            # encoded_jwt= encoded_jwt.decode("utf-8")

            response = jsonify({'Final_Token': encoded_jwt})

        return response

    except Exception as e:

        return jsonify('Bad Token')


@app.route('/logout', methods=['GET', 'POST'])
def logout():

    data = json.loads(request.data.decode('utf-8'))
    logout_token = data['headers']['token']

    logout_token = logout_token.encode('utf-8')

    logout = jwt.decode(logout_token, 'it@posoco', algorithms=['HS256'])

    global logout_user

    if logout['User'] not in logout_user:
        logout_user.append(logout['User'])

    return 'response'


@app.route('/visit', methods=['GET', 'POST'])
def visit():
    # return redirect("http://www.google.com", code=302, Response={'Authorization' : '112233'})

    response = Response(
        headers={'Authorization': 'whatever'}, url="http://www.google.com")
    return response


if __name__ == '__main__':

    app.debug = True

    app.run(host='0.0.0.0', port=5000)
