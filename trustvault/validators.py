"""
Custom password validators for TrustVault strong password policy.

Validates that passwords meet the following requirements:
1. Minimum 6 characters
2. At least one uppercase letter (A-Z)
3. At least one lowercase letter (a-z)
4. At least one numeric digit (0-9)
5. At least one special character (e.g. @, #, $, %, &, *)
6. No leading or trailing whitespace
7. Password confirmation must match (when used in form validation)

Do not silently trim or modify passwords. Reject invalid whitespace instead.
"""

from django.core.exceptions import ValidationError
import re


def validate_minimum_length(value):
    """Validate minimum 6 characters."""
    if len(value) < 6:
        raise ValidationError(
            'Password must be at least 6 characters long.',
            code='too_short',
        )


def validate_uppercase(value):
    """Validate at least one uppercase letter."""
    if not re.search(r'[A-Z]', value):
        raise ValidationError(
            'Password must contain at least one uppercase letter (A-Z).',
            code='no_uppercase',
        )


def validate_lowercase(value):
    """Validate at least one lowercase letter."""
    if not re.search(r'[a-z]', value):
        raise ValidationError(
            'Password must contain at least one lowercase letter (a-z).',
            code='no_lowercase',
        )


def validate_digit(value):
    """Validate at least one numeric digit."""
    if not re.search(r'[0-9]', value):
        raise ValidationError(
            'Password must contain at least one numeric digit (0-9).',
            code='no_digit',
        )


def validate_special_character(value):
    """Validate at least one special character."""
    if not re.search(r'[!@#$%&*]', value):
        raise ValidationError(
            'Password must contain at least one special character (!@#$%&*).',
            code='no_special',
        )


def validate_no_leading_trailing_whitespace(value):
    """Reject leading and trailing whitespace."""
    if value != value.strip():
        raise ValidationError(
            'Password must not have leading or trailing whitespace.',
            code='whitespace',
        )


class StrongPasswordValidator:
    """
    Combined password validator that runs all checks.
    Used by Django's authentication system.
    """

    def __init__(self):
        self.validators = [
            validate_minimum_length,
            validate_uppercase,
            validate_lowercase,
            validate_digit,
            validate_special_character,
            validate_no_leading_trailing_whitespace,
        ]

    def __call__(self, password, **kwargs):
        """Run all validation checks on the password."""
        for validator in self.validators:
            validator(password)

    def __repr__(self):
        return '<StrongPasswordValidator>'


def get_validators():
    """Return list of validator instances for Django."""
    return [StrongPasswordValidator()]