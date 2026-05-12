import ldap

conn = ldap.initialize('ldap://10.3.110.120')
conn.set_option(ldap.OPT_X_TLS_REQUIRE_CERT, ldap.OPT_X_TLS_NEVER)
try:
    conn.start_tls_s()
except Exception as e:
    print('StartTLS failed')

try:
    conn.simple_bind_s(r'erldc\administrator', 'EradRT$A09')
    res = conn.search_s('dc=erldc,dc=net', ldap.SCOPE_SUBTREE, '(sAMAccountName=00162)')
    print('Search worked after failed StartTLS!')
except Exception as e:
    print('Search failed after StartTLS:', type(e).__name__, str(e))
