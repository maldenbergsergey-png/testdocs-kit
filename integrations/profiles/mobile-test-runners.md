# Запуск сохранённых мобильных автотестов

| Цель | Исследование экрана | Запуск сохранённого YAML |
| --- | --- | --- |
| Android Emulator или телефон по USB с ADB | Maestro MCP | Maestro MCP или официальный Maestro CLI с ID устройства |
| iOS Simulator на macOS | Maestro MCP | Maestro MCP или официальный Maestro CLI с UDID симулятора |
| Физический iPhone, в том числе подключённый к Windows | Appium MCP с подготовленным Appium Server | DeviceLab `maestro-runner` с драйвером `appium` и доступом к этому серверу |

Для Android подходит установленная тестовая APK, для симулятора нужна сборка `.app` под Simulator, для физического iPhone подходит установленная сборка из TestFlight. Сверить версию, номер сборки и тестовый backend. Выделить телефон на время прогона, согласовать освобождение от конкурирующей сессии с её владельцем. Подготовка подписанного WDA и Windows-туннеля описана в [памятке по устройствам](../../docs/mobile-testing.md). Версии runner и драйвера зафиксировать в проекте после пробного прогона используемых команд на целевом iPhone.

## На рабочем месте

В [Maestro MCP](maestro.md) выбрать устройство через `list_devices`. Для `run` передать `device_id` и `files` со списком файлов либо `dir` с папкой. У папки можно задать `include_tags`/`exclude_tags`. MCP может вернуть значения `env` в ответе, поэтому там указывают открытые параметры, например `APP_ID`. Для авторизованного сценария подходит подготовленная тестовая сессия. Путь к flow должен быть доступен процессу MCP. В старом CLI выбирать файловую операцию по реальной схеме. Интерактивная проверка через [Appium MCP](appium.md) помогает подобрать локаторы на iPhone. Для подтверждения автотеста запустить версию YAML с диска.

## Из терминала и CI

[Команда запуска](../../skills/automate-mobile-tests/scripts/run_flows.py) работает на macOS, Linux и WSL с Python 3.8+ и выбранным CLI в PATH. Скрипт можно использовать отдельно от kit. Один вызов запускает файл или папку на одном устройстве. Команды ниже выполняются из корня репозитория тестов. Переменная `KIT` указывает на установленный пакет.

```sh
python3 "$KIT/skills/automate-mobile-tests/scripts/run_flows.py" .maestro/smoke \
  --device "$DEVICE_ID" --app-id "$APP_ID" --output "$ARTIFACTS"

python3 "$KIT/skills/automate-mobile-tests/scripts/run_flows.py" .maestro/smoke \
  --appium-url "$APPIUM_SERVER_URL" --appium-caps "$CAPS_FILE" \
  --app-id "$APP_ID" --output "$ARTIFACTS"
```

`--app-id` задаёт публичную переменную flow `APP_ID`, если она используется. `--output` задаёт родительский каталог. Для каждого вызова создаётся отдельная папка с JUnit и доступными диагностическими файлами. Команда сохраняет код сбоя runner и проверяет свежий отчёт при успешном выходе. Секреты передаются штатным механизмом выбранного исполнителя из приватных переменных CI. Capabilities брать из приватного файла с UDID выделенного телефона и настройками WDA. В WSL путь к файлу и адрес Appium Server должны быть доступны из WSL.

На Windows можно вызвать нативный Maestro напрямую из PowerShell. Здесь `ARTIFACTS` указывает на новый каталог отчёта.

```powershell
maestro --device "$env:DEVICE_ID" test --format junit --output "$env:ARTIFACTS/junit.xml" --test-output-dir "$env:ARTIFACTS" -e "APP_ID=$env:APP_ID" .maestro/smoke
exit $LASTEXITCODE
```

На подготовленном iPhone тот же файл запускается через DeviceLab.

```sh
maestro-runner --platform ios --driver appium --appium-url "$APPIUM_SERVER_URL" --caps "$CAPS_FILE" test --output "$ARTIFACTS" --flatten -e "APP_ID=$APP_ID" .maestro/smoke
```

CI берёт сборку нужной ревизии, поднимает симулятор/эмулятор или резервирует телефон с нужной версией приложения. Для двух платформ использовать отдельные задания с независимыми данными. Сохранять JUnit, скриншоты и логи даже при ошибке. Если при переходе от MCP к CLI завершился драйвер XCTest до первого шага, проверить журнал драйвера и доступность симулятора для отдельной сессии. Для повторного запуска сохранить отдельный отчёт. У отдельного QA-репозитория привязывать прогон к номеру сборки и ревизии тестов. Короткий набор можно запускать на PR после сборки, расширенный регресс - перед релизом или по запросу команды.

Параметры приведены в [Maestro CLI](https://docs.maestro.dev/maestro-cli/maestro-cli-commands-and-options), [отчётах Maestro](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts), [DeviceLab maestro-runner](https://github.com/devicelab-dev/maestro-runner), [CLI DeviceLab](https://devicelab.dev/open-source/maestro-runner/docs/cli-reference) и [Appium на Windows](https://appium.github.io/appium-xcuitest-driver/latest/guides/non-macos-hosts/).
