import win32com.client
import ldap

# AD details
dc = "10.3.110.120"
admin_user = r"erldc\administrator"
admin_pass = "EradRT$A09"

try:
    conn = ldap.initialize(f"ldap://{dc}")
    conn.protocol_version = ldap.VERSION3
    conn.set_option(ldap.OPT_REFERRALS, 0)
    conn.simple_bind_s(admin_user, admin_pass)
    
    res = conn.search_s("dc=erldc,dc=net", ldap.SCOPE_SUBTREE, "(sAMAccountName=00162)", ["distinguishedName"])
    dn = res[0][0]
    print(f"Found DN: {dn}")
    
    # Try ADSI
    print("Testing ADSI password reset...")
    dso = win32com.client.GetObject("LDAP:")
    # 1 = ADS_SECURE_AUTHENTICATION
    obj = dso.OpenDSObject(f"LDAP://{dc}/{dn}", admin_user, admin_pass, 1)
    
    # We won't actually change it to keep it safe for now, just seeing if we get the object
    print("Successfully got ADSI object:", obj.Name)
    print("ADSI is working!")
except Exception as e:
    print(f"Error: {e}")
