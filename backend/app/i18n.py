"""Backend xabarlari uchun 3 tilli tarjima (uz / ru / en).

Manba til — o'zbekcha matn (kalit). Tarjima topilmasa o'zbekcha matn qaytariladi, shuning uchun tizim hech qachon sinmaydi.
`{nom}` ko'rinishidagi o'rinbosarlar T(kalit, nom=qiymat) bilan to'ldiriladi.
"""
import re
from contextvars import ContextVar

LANGS = ("uz", "ru", "en")
current_lang: ContextVar[str] = ContextVar("current_lang", default="uz")


def pick_lang(header: str | None, fallback: str = "uz") -> str:
    """Accept-Language dan til tanlaydi: 'ru-RU,ru;q=0.9' -> 'ru'."""
    for part in (header or "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in LANGS:
            return code
    return fallback


# kalit (uz) -> (ru, en)
M: dict[str, tuple[str, str]] = {
    # --- auth ---
    "Emailingizga 6 xonali tasdiqlash kodi yuborildi": ("Код подтверждения из 6 цифр отправлен на ваш email", "A 6-digit verification code was sent to your email"),
    "Bu email bilan hisob mavjud. Tizimga kiring yoki parolni tiklang": ("Аккаунт с этим email уже существует. Войдите или восстановите пароль", "An account with this email already exists. Log in or reset your password"),
    "Bu email bilan ro'yxatdan o'tish hozircha yopilgan": ("Регистрация временно закрыта", "Registration is temporarily closed"),
    "Kod noto'g'ri yoki muddati tugagan": ("Код неверный или истёк", "The code is invalid or has expired"),
    "Email allaqachon tasdiqlangan. Tizimga kiring": ("Email уже подтверждён. Войдите в систему", "Email is already verified. Please log in"),
    "Agar hisob mavjud bo'lsa, yangi kod yuborildi": ("Если аккаунт существует, новый код отправлен", "If the account exists, a new code has been sent"),
    "Email yoki parol noto'g'ri": ("Неверный email или пароль", "Incorrect email or password"),
    "Hisobingiz bloklangan. Administrator bilan bog'laning": ("Ваш аккаунт заблокирован. Свяжитесь с администратором", "Your account is blocked. Please contact the administrator"),
    "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash kodi yuborildi": ("Если этот email зарегистрирован, код восстановления пароля отправлен", "If this email is registered, a password reset code has been sent"),
    "Joriy parol noto'g'ri": ("Текущий пароль неверный", "The current password is incorrect"),
    "Tizimga qayta kiring (sessiya tugagan)": ("Войдите снова (сессия истекла)", "Please log in again (session expired)"),
    "Bu amal uchun ruxsat yo'q": ("У вас нет доступа к этому действию", "You do not have permission for this action"),
    "Kod muddati tugagan yoki topilmadi. Yangi kod so'rang": ("Код истёк или не найден. Запросите новый код", "The code has expired or was not found. Request a new one"),
    "Urinishlar soni tugadi. Yangi kod so'rang": ("Попытки закончились. Запросите новый код", "No attempts left. Request a new code"),
    "Kod noto'g'ri. Qolgan urinishlar: {left}": ("Неверный код. Осталось попыток: {left}", "Incorrect code. Attempts left: {left}"),
    "Yangi kodni {wait} soniyadan keyin so'rashingiz mumkin": ("Новый код можно запросить через {wait} сек.", "You can request a new code in {wait} seconds"),
    "Juda ko'p urinish. {wait} soniyadan keyin qayta urinib ko'ring": ("Слишком много попыток. Повторите через {wait} сек.", "Too many attempts. Try again in {wait} seconds"),
    "Emailga kod yuborib bo'lmadi. Birozdan so'ng «Qayta yuborish» ni bosing yoki administratorga murojaat qiling": ("Не удалось отправить код на email. Немного позже нажмите «Отправить повторно» или обратитесь к администратору", "Could not send the code by email. Try «Resend» in a moment or contact the administrator"),
    "O'zingizning admin huquqingizni olib tashlay olmaysiz": ("Нельзя снять права администратора с самого себя", "You cannot remove your own admin rights"),
    # --- fayllar ---
    "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin": ("Можно загружать только JPG, PNG или WEBP", "Only JPG, PNG or WEBP images are allowed"),
    "Rasm hajmi {mb} MB dan oshmasligi kerak": ("Размер изображения не должен превышать {mb} МБ", "Image size must not exceed {mb} MB"),
    "Fayl bo'sh": ("Файл пустой", "The file is empty"),
    "Rasm faylini o'qib bo'lmadi": ("Не удалось прочитать изображение", "Could not read the image file"),
    "Rasmni saqlab bo'lmadi. Birozdan so'ng urinib ko'ring": ("Не удалось сохранить изображение. Попробуйте позже", "Could not save the image. Try again later"),
    # --- buyurtmalar ---
    "Buyurtma topilmadi": ("Заказ не найден", "Booking not found"),
    "Ijodkor topilmadi yoki hozir buyurtma qabul qilmaydi": ("Мастер не найден или сейчас не принимает заказы", "Creator not found or not accepting bookings right now"),
    "O'tgan sanaga buyurtma berib bo'lmaydi": ("Нельзя заказать на прошедшую дату", "You cannot book a past date"),
    "Bu ijodkorga javob kutilayotgan buyurtmalaringiz ko'p. Avval javobni kuting": ("У вас много заказов этому мастеру без ответа. Сначала дождитесь ответа", "You have many pending bookings with this creator. Please wait for a reply first"),
    "Tanlangan xizmat topilmadi": ("Выбранная услуга не найдена", "The selected service was not found"),
    "Ijodkor bu sanada band (dam olish yoki boshqa ish)": ("Мастер занят в эту дату (выходной или другая работа)", "The creator is unavailable on this date (day off or other work)"),
    "Bu sanada ijodkorda tasdiqlangan buyurtma bor": ("В эту дату у мастера уже есть подтверждённый заказ", "The creator already has a confirmed booking on this date"),
    "Bu vaqt band: {start} dan {hours} soatlik buyurtma bor": ("Это время занято: заказ с {start} на {hours} ч.", "This time is taken: a booking from {start} for {hours} h"),
    "Buyurtmani faqat mijoz tahrirlay oladi": ("Заказ может изменить только клиент", "Only the customer can edit a booking"),
    "Faqat javob kutilayotgan buyurtmani tahrirlash mumkin": ("Можно изменить только заказ, ожидающий ответа", "Only a pending booking can be edited"),
    "O'tgan sanani tanlab bo'lmaydi": ("Нельзя выбрать прошедшую дату", "You cannot choose a past date"),
    "«{from_}» holatidagi buyurtmani «{to}» holatiga o'tkazib bo'lmaydi": ("Заказ в статусе «{from_}» нельзя перевести в «{to}»", "A booking in status «{from_}» cannot be changed to «{to}»"),
    "Tadbir sanasi hali kelmagan — bajarildi deb belgilab bo'lmaydi": ("Дата события ещё не наступила — нельзя отметить выполненным", "The event date has not come yet — it cannot be marked completed"),
    "Faqat kutilayotgan, bekor qilingan yoki rad etilgan buyurtmani o'chirish mumkin": ("Удалить можно только ожидающий, отменённый или отклонённый заказ", "Only pending, cancelled or rejected bookings can be deleted"),
    "Ijodkor buyurtmani o'chira olmaydi — rad eting yoki bekor qiling": ("Мастер не может удалить заказ — отклоните или отмените его", "A creator cannot delete a booking — reject or cancel it"),
    "Oy formati YYYY-MM bo'lsin": ("Формат месяца: ГГГГ-ММ", "Month format must be YYYY-MM"),
    "Sharh faqat bajarilgan buyurtmaga yoziladi": ("Отзыв можно оставить только к выполненному заказу", "Reviews can only be left for completed bookings"),
    "Bu buyurtmaga sharh allaqachon yozilgan": ("Отзыв к этому заказу уже оставлен", "A review has already been left for this booking"),
    "Sharh topilmadi": ("Отзыв не найден", "Review not found"),
    # --- ijodkor ---
    "Ijodkor topilmadi": ("Мастер не найден", "Creator not found"),
    "Ijodkor profili topilmadi": ("Профиль мастера не найден", "Creator profile not found"),
    "Rasm topilmadi": ("Фото не найдено", "Photo not found"),
    "Xizmat topilmadi": ("Услуга не найдена", "Service not found"),
    "Ko'pi bilan 20 ta xizmat qo'shish mumkin": ("Можно добавить не более 20 услуг", "You can add at most 20 services"),
    "Portfolioda ko'pi bilan {max} ta rasm bo'lishi mumkin": ("В портфолио может быть не более {max} фото", "A portfolio can hold at most {max} photos"),
    "O'tgan sanani band qilib bo'lmaydi": ("Нельзя заблокировать прошедшую дату", "You cannot block a past date"),
    "Bu sana allaqachon band qilingan": ("Эта дата уже заблокирована", "This date is already blocked"),
    "Bu sanada tasdiqlangan buyurtma bor": ("На эту дату есть подтверждённый заказ", "There is a confirmed booking on this date"),
    "Topilmadi": ("Не найдено", "Not found"),
    # --- xabarlar ---
    "Xabar bo'sh bo'lmasin": ("Сообщение не должно быть пустым", "The message must not be empty"),
    "Qabul qiluvchi topilmadi": ("Получатель не найден", "Recipient not found"),
    "Bu foydalanuvchiga xabar yuborib bo'lmaydi": ("Этому пользователю нельзя отправить сообщение", "You cannot message this user"),
    "Foydalanuvchi topilmadi": ("Пользователь не найден", "User not found"),
    # --- yangi modullar ---
    "Qiymat noto'g'ri": ("Недопустимое значение", "Invalid value"),
    "To'lov topilmadi": ("Платёж не найден", "Payment not found"),
    "To'lovni faqat qabul qilingan yoki bajarilgan buyurtmaga qo'shish mumkin": ("Платёж можно добавить только к принятому или выполненному заказу", "Payments can only be added to accepted or completed bookings"),
    "To'lov summasi noto'g'ri": ("Неверная сумма платежа", "Invalid payment amount"),
    "Bu to'lov allaqachon ko'rib chiqilgan": ("Этот платёж уже рассмотрен", "This payment has already been reviewed"),
    "Faqat ijodkor to'lovni tasdiqlay oladi": ("Платёж может подтвердить только мастер", "Only the creator can confirm a payment"),
    "Ijodkor topilmadi yoki o'zingizga shikoyat qilib bo'lmaydi": ("Мастер не найден или нельзя пожаловаться на себя", "Creator not found or you cannot report yourself"),
    "Shikoyat topilmadi": ("Жалоба не найдена", "Complaint not found"),
    "Kategoriya topilmadi": ("Категория не найдена", "Category not found"),
    "Bu nomli kategoriya mavjud": ("Категория с таким названием уже существует", "A category with this name already exists"),
    "Sevimlilarga faqat mijoz qo'sha oladi": ("В избранное может добавлять только клиент", "Only customers can add favorites"),
    "Bu rolda amal bajarib bo'lmaydi": ("Это действие недоступно для вашей роли", "This action is not available for your role"),
    "Ma'lumotlar noto'g'ri": ("Данные заполнены неверно", "The data is invalid"),
    "to'ldirilishi shart": ("обязательное поле", "is required"),
    "kamida {n} ta belgi bo'lsin": ("минимум {n} симв.", "at least {n} characters"),
    "ko'pi bilan {n} ta belgi bo'lsin": ("максимум {n} симв.", "at most {n} characters"),
    "{n} dan katta bo'lsin": ("должно быть не меньше {n}", "must be at least {n}"),
    "{n} dan oshmasin": ("не должно превышать {n}", "must not exceed {n}"),
    "sana noto'g'ri": ("неверная дата", "invalid date"),
    "formati noto'g'ri": ("неверный формат", "invalid format"),
    "email manzil noto'g'ri": ("неверный email", "invalid email address"),
    "son bo'lishi kerak": ("должно быть числом", "must be a number"),
    "qiymati noto'g'ri": ("недопустимое значение", "invalid value"),
    "noto'g'ri qiymat": ("недопустимое значение", "invalid value"),
    "Parol kamida 8 belgidan iborat bo'lsin": ("Пароль должен содержать минимум 8 символов", "Password must be at least 8 characters"),
    "Parolda kamida bitta harf va bitta raqam bo'lsin": ("В пароле должна быть хотя бы одна буква и одна цифра", "Password must contain at least one letter and one digit"),
    "Vaqt HH:MM formatida bo'lsin": ("Время в формате ЧЧ:ММ", "Time must be in HH:MM format"),
    # --- maydon nomlari ---
    "Ism": ("Имя", "Name"), "Email": ("Email", "Email"), "Parol": ("Пароль", "Password"),
    "Yangi parol": ("Новый пароль", "New password"), "Telefon": ("Телефон", "Phone"), "Kod": ("Код", "Code"),
    "Nomi": ("Название", "Title"), "Sana": ("Дата", "Date"), "Vaqt": ("Время", "Time"), "Manzil": ("Адрес", "Address"),
    "Narx": ("Цена", "Price"), "Ko'rinadigan ism": ("Отображаемое имя", "Display name"), "Shahar": ("Город", "City"),
    "Baho": ("Оценка", "Rating"), "Xabar": ("Сообщение", "Message"), "Davomiylik": ("Длительность", "Duration"),
    "Bio": ("О себе", "Bio"),
    # --- holatlar ---
    "Kutilmoqda": ("Ожидает", "Pending"), "Qabul qilindi": ("Принят", "Accepted"), "Rad etildi": ("Отклонён", "Rejected"),
    "Bekor qilindi": ("Отменён", "Cancelled"), "Bajarildi": ("Выполнен", "Completed"),
    # --- bildirishnomalar ---
    "Buyurtma holati: {label}": ("Статус заказа: {label}", "Booking status: {label}"),
    "«{title}» ({date}) — {label}.": ("«{title}» ({date}) — {label}.", "“{title}” ({date}) — {label}."),
    " Izoh: {note}": (" Комментарий: {note}", " Note: {note}"),
    "Yangi buyurtma": ("Новый заказ", "New booking"),
    "Buyurtma o'zgartirildi": ("Заказ изменён", "Booking updated"),
    "«{title}» buyurtmasi tafsilotlari yangilandi": ("Детали заказа «{title}» обновлены", "Details of booking “{title}” were updated"),
    "Yangi sharh: {stars}": ("Новый отзыв: {stars}", "New review: {stars}"),
    "Mijoz baho qoldirdi": ("Клиент поставил оценку", "A customer left a rating"),
    "Sharhingizga javob berildi": ("На ваш отзыв ответили", "Your review received a reply"),
    "Yangi xabar: {name}": ("Новое сообщение: {name}", "New message: {name}"),
    "Profilingiz tasdiqlandi ✓": ("Ваш профиль подтверждён ✓", "Your profile has been verified ✓"),
    "Administrator profilingizni tekshirdi. Endi katalogda «Tasdiqlangan» belgisi bilan chiqasiz.": ("Администратор проверил ваш профиль. Теперь в каталоге у вас значок «Проверено».", "An administrator reviewed your profile. You now appear in the catalog with a “Verified” badge."),
    "Yangi to'lov: {amount} so'm": ("Новый платёж: {amount} сум", "New payment: {amount} UZS"),
    "To'lov tasdiqlandi: {amount} so'm": ("Платёж подтверждён: {amount} сум", "Payment confirmed: {amount} UZS"),
    "To'lov rad etildi: {amount} so'm": ("Платёж отклонён: {amount} сум", "Payment rejected: {amount} UZS"),
    "«{title}» buyurtmasi bo'yicha": ("По заказу «{title}»", "For booking “{title}”"),
    "Shikoyatingiz ko'rib chiqildi": ("Ваша жалоба рассмотрена", "Your complaint was reviewed"),
    "Holat: {status}": ("Статус: {status}", "Status: {status}"),
    # --- email ---
    "Assalomu alaykum, {name}!": ("Здравствуйте, {name}!", "Hello, {name}!"),
    "{code} — {app} tasdiqlash kodi": ("{code} — код подтверждения {app}", "{code} — {app} verification code"),
    "{code} — parolni tiklash kodi": ("{code} — код восстановления пароля", "{code} — password reset code"),
    "Email manzilingizni tasdiqlang": ("Подтвердите ваш email", "Verify your email address"),
    "Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting:": ("Чтобы завершить регистрацию, введите код:", "Enter this code to finish signing up:"),
    "Parolni tiklash": ("Восстановление пароля", "Password reset"),
    "Yangi parol o'rnatish uchun quyidagi kodni kiriting:": ("Чтобы установить новый пароль, введите код:", "Enter this code to set a new password:"),
    "Kod {ttl} daqiqa davomida amal qiladi. Uni hech kimga bermang.": ("Код действует {ttl} мин. Никому его не сообщайте.", "The code is valid for {ttl} minutes. Do not share it with anyone."),
    "Bu xat avtomatik yuborildi. Agar siz bu amalni bajarmagan bo'lsangiz, xatni e'tiborsiz qoldiring.": ("Это письмо отправлено автоматически. Если вы не совершали это действие, проигнорируйте его.", "This email was sent automatically. If you did not request this, please ignore it."),
    "Ko'rish": ("Открыть", "View"),
}

# kalit -> (ru, en) lug'ati tezkor qidiruv uchun
_RE_CACHE: list[tuple[re.Pattern, str]] = []


def _compile():
    for key in M:
        if "{" in key:
            pat = re.escape(key)
            pat = re.sub(r"\\\{(\w+)\\\}", r"(?P<\1>.+?)", pat)
            _RE_CACHE.append((re.compile(f"^{pat}$", re.S), key))


_compile()


def tr(lang: str, key: str, **vars) -> str:
    """Kalitni `lang` tiliga o'giradi va o'rinbosarlarni to'ldiradi."""
    if lang == "ru" and key in M:
        text = M[key][0]
    elif lang == "en" and key in M:
        text = M[key][1]
    else:
        text = key
    if vars:
        try:
            text = text.format(**vars)
        except (KeyError, IndexError, ValueError):
            pass
    return text


def T(key: str, **vars) -> str:
    """So'rov tilida (Accept-Language) tarjima."""
    return tr(current_lang.get(), key, **vars)


def translate_text(lang: str, text: str) -> str:
    """Tayyor (formatlangan) o'zbekcha matnni tarjima qiladi: avval aniq moslik, so'ng shablonlar bo'yicha."""
    if lang == "uz" or not text:
        return text
    if text in M:
        return tr(lang, text)
    if " Izoh: " in text:
        head, note = text.split(" Izoh: ", 1)
        return translate_text(lang, head) + tr(lang, " Izoh: {note}", note=note)
    for rx, key in _RE_CACHE:
        m = rx.match(text)
        if m:
            vals = m.groupdict()
            # ichki «holat» nomlarini ham o'giramiz
            vals = {k: (tr(lang, v) if v in M else v) for k, v in vals.items()}
            return tr(lang, key, **vals)
    return text


STATUS_KEYS = {"pending": "Kutilmoqda", "accepted": "Qabul qilindi", "rejected": "Rad etildi",
               "cancelled": "Bekor qilindi", "completed": "Bajarildi"}


def status_label(lang: str, status: str) -> str:
    return tr(lang, STATUS_KEYS.get(status, status))
