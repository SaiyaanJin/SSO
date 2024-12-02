import ldap

l = ldap.initialize("ldap://10.3.100.120")

l.protocol_version = ldap.VERSION3

l.set_option(ldap.OPT_REFERRALS, 0)

bind = l.simple_bind_s("erldc\\administrator", "EradRT$A09")

result = l.search_s('dc=erldc,dc=net', ldap.SCOPE_SUBTREE,
                    'userPrincipalName=*', [])

l = []

for item in result:
    try:
        print(item[1])
    except:
        pass


# OU = result[0][0].split(",")[1][3:]
