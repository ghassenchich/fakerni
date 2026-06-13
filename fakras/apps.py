import os
import sys

from django.apps import AppConfig


class FakrasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'fakras'

    def ready(self):
        if not self._should_start_scheduler():
            return

        from django.conf import settings
        from apscheduler.schedulers.background import BackgroundScheduler

        from .reminders import send_due_date_reminders
        from .recurrence import create_recurring_instances

        scheduler = BackgroundScheduler()
        scheduler.add_job(
            send_due_date_reminders,
            "interval",
            minutes=settings.FAKRA_REMINDER_CHECK_INTERVAL_MINUTES,
            id="send_due_date_reminders",
        )
        scheduler.add_job(
            create_recurring_instances,
            "interval",
            minutes=settings.FAKRA_RECURRENCE_CHECK_INTERVAL_MINUTES,
            id="process_recurring_fakras",
        )
        scheduler.start()

    @staticmethod
    def _should_start_scheduler():
        skip_commands = {"test", "migrate", "makemigrations", "collectstatic", "shell"}
        if any(cmd in sys.argv for cmd in skip_commands):
            return False

        # Under `manage.py runserver`, the autoreloader re-imports apps in a
        # parent and a child process; only start in the child (RUN_MAIN=true)
        # to avoid running the job twice.
        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return False

        return True
