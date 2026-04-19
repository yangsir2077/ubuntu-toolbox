FROM python:3.10-slim

LABEL maintainer="Ubuntu Toolbox"
LABEL description="Ubuntu System Management Toolbox - Web UI for WeChat/QQ install + Auto Login + No Sleep"

WORKDIR /app

# 安装系统依赖（用于运行用户脚本，如需在容器内测试）
RUN apt-get update && apt-get install -y \
    wget gnupg2 curl gnome-terminal wine64 sudo \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用
COPY . .

EXPOSE 5000

ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# 使用 gunicorn 运行（生产级）
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
