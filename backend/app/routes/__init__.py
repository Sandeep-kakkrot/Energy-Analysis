"""
Register all route blueprints with the Flask app.
"""
from .auth      import auth_bp
from .dashboard import bp as dashboard_bp
from .buildings import bp as buildings_bp
from .trends    import bp as trends_bp
from .peaks     import bp as peaks_bp
from .wastage   import bp as wastage_bp
from .spark     import spark_bp
from .upload    import bp as upload_bp
from flask import Flask


def register_routes(app: Flask) -> None:
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(buildings_bp)
    app.register_blueprint(trends_bp)
    app.register_blueprint(peaks_bp)
    app.register_blueprint(wastage_bp)
    app.register_blueprint(spark_bp)
    app.register_blueprint(upload_bp)

    @app.get("/api/health")
    def health():
        """Public health-check — no JWT required."""
        return {"status": "ok", "service": "Campus Energy Analysis API"}
