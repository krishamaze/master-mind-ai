"""Tests for the assignment API endpoints."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status

from api.models import Assignment, UserProfile


class AssignmentAPITests(TestCase):
    """Verify assignment creation resolves owners to ``User`` instances."""

    def setUp(self) -> None:
        self.user = User.objects.create_user(username='owner', password='password123')
        self.profile = UserProfile.objects.create(user=self.user)

    def test_assignment_creation_uses_user_owner(self) -> None:
        payload = {
            'name': 'NewAssign',
            'app_id': 'ABCDEFGH',
            'user_id': self.profile.pk,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        data = response.json()
        assignment = Assignment.objects.get(pk=data['id'])

        self.assertEqual(assignment.owner, self.user)
        self.assertEqual(assignment.owner_id, self.user.id)
        self.assertEqual(data['owner'], self.user.id)
        self.assertIsInstance(assignment.owner, User)
        self.assertEqual(Assignment.objects.count(), 1)

    def test_assignment_creation_accepts_username_identifier(self) -> None:
        payload = {
            'name': 'UsernameAssign',
            'app_id': 'HGFEDCBA',
            'user_id': self.user.username,
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assignment = Assignment.objects.get(name='UsernameAssign')

        self.assertEqual(assignment.owner, self.user)
        self.assertEqual(assignment.app_id, 'HGFEDCBA')

    def test_assignment_creation_rejects_unknown_user(self) -> None:
        payload = {
            'name': 'InvalidAssign',
            'app_id': 'ABCDEF12',
            'user_id': 'unknown-user',
        }

        response = self.client.post(
            '/api/v1/assignments/',
            data=payload,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()

        self.assertIn('owner', data)
        self.assertEqual(Assignment.objects.count(), 0)
