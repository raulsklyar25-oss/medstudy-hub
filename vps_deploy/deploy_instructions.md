# Инструкция по развертыванию MedStudy Hub на VPS 🖥️

Это пошаговое руководство поможет вам развернуть проект на собственном виртуальном сервере (VPS/VDS) с операционной системой **Ubuntu 20.04 / 22.04 LTS**.

---

## 1. Подключение к серверу и установка окружения

Зайдите на ваш VPS по SSH:
```bash
ssh root@IP_АДРЕС_ВАШЕГО_СЕРВЕРА
```

Обновите пакеты системы:
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js (v18 или v20):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Установка Nginx (веб-сервер и реверс-прокси):
```bash
sudo apt install nginx -y
```

### Установка Git:
```bash
sudo apt install git -y
```

---

## 2. Загрузка проекта на сервер

Создайте рабочую директорию и сделайте текущего пользователя её владельцем:
```bash
sudo mkdir -p /var/www/medstudy-hub
sudo chown -R $USER:$USER /var/www/medstudy-hub
```

Перейдите в директорию и клонируйте проект (или скопируйте файлы):
```bash
cd /var/www/medstudy-hub
git clone https://github.com/raulsklyar25-oss/medstudy-hub.git .
```

---

## 3. Настройка и запуск бэкенда (Node.js)

Перейдите в папку бэкенда и установите зависимости:
```bash
cd /var/www/medstudy-hub/backend
npm install
```

Создайте файл `.env` из шаблона:
```bash
cp /var/www/medstudy-hub/vps_deploy/.env.example /var/www/medstudy-hub/backend/.env
```

Отредактируйте `.env` через встроенный редактор `nano`:
```bash
nano .env
```
*(Укажите случайный сложный JWT_SECRET. Сохраните файл: нажмите Ctrl+O, затем Enter. Выйдите: Ctrl+X).*

### Запуск бэкенда как службы (systemd)
Чтобы бэкенд работал постоянно в фоне и перезапускался сам при перезагрузке сервера:

1. Скопируйте файл службы в системную директорию:
   ```bash
   sudo cp /var/www/medstudy-hub/vps_deploy/medstudy.service /etc/systemd/system/medstudy.service
   ```
2. Установите права владельца на папки бэкенда для пользователя `www-data` (под которым будет работать служба):
   ```bash
   sudo chown -R www-data:www-data /var/www/medstudy-hub/backend
   ```
3. Запустите службу и добавьте в автозагрузку:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start medstudy
   sudo systemctl enable medstudy
   ```
4. Проверить статус службы (должен быть `active (running)`):
   ```bash
   sudo systemctl status medstudy
   ```

---

## 4. Настройка Nginx и публикация сайта

Удалите конфигурацию Nginx по умолчанию:
```bash
sudo rm /etc/nginx/sites-enabled/default
```

Скопируйте конфигурацию Nginx вашего проекта:
```bash
sudo cp /var/www/medstudy-hub/vps_deploy/nginx.conf /etc/nginx/sites-available/medstudy
sudo ln -s /etc/nginx/sites-available/medstudy /etc/nginx/sites-enabled/
```

Отредактируйте конфигурационный файл, указав ваше доменное имя:
```bash
sudo nano /etc/nginx/sites-available/medstudy
```
*(Найдите строку `server_name yourdomain.com www.yourdomain.com;` и замените её на ваш купленный домен, например `medstudyhub.ru www.medstudyhub.ru`).*

Проверьте конфигурацию Nginx на наличие синтаксических ошибок:
```bash
sudo nginx -t
```

Перезапустите Nginx:
```bash
sudo systemctl restart nginx
```

---

## 5. Получение бесплатного SSL-сертификата (HTTPS)

Для работы чата, мультиплеера и авторизации обязательно нужен защищённый HTTPS-протокол.
Установите Certbot для автоматического выпуска сертификатов Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx -y
```

Запустите получение сертификата для вашего домена (замените `yourdomain.com` на ваш домен):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
*Нажмите **2**, чтобы автоматически перенаправлять весь трафик с HTTP на HTTPS.*

---

## 6. Отслеживание и мониторинг логов сервера

С этого момента бэкенд и фронтенд полностью запущены! Чтобы следить за логами бэкенда в реальном времени (кто подключается к сокетам, ошибки, действия):
```bash
sudo journalctl -u medstudy -f
```

Чтобы посмотреть логи ошибок веб-сервера Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
```
