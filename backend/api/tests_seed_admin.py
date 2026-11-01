from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import identify_hasher
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .management.commands.seed_admin import ADMIN_EMAIL, ADMIN_PASSWORD_HASH
from .models import Profile

User = get_user_model()


class SeedAdminTests(TestCase):
    def login(self, password):
        return APIClient().post(
            "/api/auth/login/", {"email": ADMIN_EMAIL, "password": password}, format="json"
        )

    def test_cria_admin_com_o_hash_e_perfil(self):
        call_command("seed_admin", verbosity=0)
        user = User.objects.get(email=ADMIN_EMAIL)
        self.assertTrue(user.is_staff and user.is_superuser and user.is_active)
        self.assertEqual(user.password, ADMIN_PASSWORD_HASH)
        self.assertEqual(identify_hasher(user.password).algorithm, "pbkdf2_sha256")
        self.assertEqual(Profile.objects.get(user=user).nickname, "Renan")
        self.assertEqual(self.login("errada").status_code, 400)

    def test_rodar_de_novo_nao_troca_a_senha_trocada_pelo_site(self):
        call_command("seed_admin", verbosity=0)
        user = User.objects.get(email=ADMIN_EMAIL)
        user.set_password("OutraSenha#2026")
        user.save()
        call_command("seed_admin", verbosity=0)
        self.assertEqual(self.login("OutraSenha#2026").status_code, 200)
        self.assertEqual(User.objects.filter(email=ADMIN_EMAIL).count(), 1)

    def test_apelido_renan_ja_usado_por_convidado(self):
        guest = User.objects.create_user(username="g@x.com", email="g@x.com", password="x")
        Profile.objects.create(user=guest, nickname="renan")
        call_command("seed_admin", verbosity=0)
        admin = User.objects.get(email=ADMIN_EMAIL)
        self.assertEqual(Profile.objects.get(user=admin).nickname, "Renan (adm)")
