"""
Flask extensions — instantiated here, initialized in the app factory.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt     import Bcrypt

db     = SQLAlchemy()
bcrypt = Bcrypt()
