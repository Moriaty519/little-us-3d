"""兼容旧入口：转发到家庭局域网服务。"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('home_server.py')), run_name='__main__')
