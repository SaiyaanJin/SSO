import os
from pprint import pprint

import ldap


LDAP_URI = os.getenv("SSO_LDAP_URI", "ldap://10.3.110.120")
LDAP_BASE_DN = os.getenv("SSO_LDAP_BASE_DN", "dc=erldc,dc=net")
LDAP_ADMIN_USER = os.getenv("SSO_LDAP_ADMIN_USER")
LDAP_ADMIN_PASSWORD = os.getenv("SSO_LDAP_ADMIN_PASSWORD")


def main():
    if not LDAP_ADMIN_USER or not LDAP_ADMIN_PASSWORD:
        raise SystemExit(
            "Set SSO_LDAP_ADMIN_USER and SSO_LDAP_ADMIN_PASSWORD before running this diagnostic."
        )

    connection = ldap.initialize(LDAP_URI)
    connection.protocol_version = ldap.VERSION3
    connection.set_option(ldap.OPT_REFERRALS, 0)
    connection.simple_bind_s(LDAP_ADMIN_USER, LDAP_ADMIN_PASSWORD)

    try:
        result = connection.search_s(
            LDAP_BASE_DN,
            ldap.SCOPE_SUBTREE,
            "(userPrincipalName=*)",
            ["cn", "mail", "sAMAccountName", "telephoneNumber", "distinguishedName"],
        )
        for _, attrs in result:
            pprint(attrs)
    finally:
        connection.unbind_s()


if __name__ == "__main__":
    main()
