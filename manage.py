#!/usr/bin/env python
"""Django's manage.py utility."""
import os
import sys

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trustvault.settings')
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        import traceback
        traceback.print_exc()
        exit(1)
    
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
