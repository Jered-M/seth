"""
Module OTP/TOTP pour authentification multifactorielle
"""

import pyotp
import qrcode
from io import BytesIO
import base64
import string
import secrets
from datetime import datetime


class OTPManager:
    """Gère la génération et validation d'OTP TOTP"""
    
    @staticmethod
    def generate_secret():
        """Génère un nouveau secret TOTP (base32)"""
        return pyotp.random_base32()
    
    @staticmethod
    def get_totp(secret):
        """Retourne une instance TOTP"""
        return pyotp.TOTP(secret)
    
    @staticmethod
    def verify_totp(secret, token):
        """Vérifie un code TOTP (avec fenêtre de tolérance)"""
        totp = pyotp.TOTP(secret)
        # Accepte le code actuel ±1 fenêtre consécutive (±30 secondes)
        return totp.verify(token, valid_window=1)
    
    @staticmethod
    def get_provisioning_uri(secret, email, issuer="SetH - Equipment Management"):
        """Génère l'URI de provisioning pour QR code"""
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=email,
            issuer_name=issuer
        )
    
    @staticmethod
    def generate_qr_code(provisioning_uri):
        """Génère un QR code en base64"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convertir en base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    def generate_backup_codes(count=10):
        """Génère des codes de secours"""
        codes = []
        for _ in range(count):
            # Format: XXXX-XXXX-XXXX (12 caractères alphanumériques)
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(12))
            formatted = f"{code[:4]}-{code[4:8]}-{code[8:12]}"
            codes.append(formatted)
        return codes
    
    @staticmethod
    def verify_backup_code(code, backup_codes):
        """Vérifie un code de secours"""
        return code in backup_codes


class BackupCodeManager:
    """Gère les codes de secours"""
    
    @staticmethod
    def hash_code(code):
        """Hash un code de secours pour stockage sécurisé"""
        import bcrypt
        return bcrypt.hashpw(code.replace('-', '').encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_code(code, hashed_code):
        """Vérifie un code de secours hashé"""
        import bcrypt
        return bcrypt.checkpw(code.replace('-', '').encode('utf-8'), hashed_code.encode('utf-8'))
