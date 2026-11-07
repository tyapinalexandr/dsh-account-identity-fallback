// Browser half of @tyapinalexandr/dsh-account-identity-fallback.
//
// Registers a row configuration page on the Plugins page: Plugins → this
// bundle → the "account-identity-fallback" row → Configure. The page edits the
// plugin's volatile identity fields, so a save is applied to the running Host
// plugin without a restart and the account surfaces refresh.
window.__ModuleLoader__.load({
	id: "@tyapinalexandr/dsh-account-identity-fallback",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;

		const NS = "accountIdentityFallback";
		const PACKAGE = "@tyapinalexandr/dsh-account-identity-fallback";
		const ROW_ID = "account-identity-fallback";
		const FIELD_NAMES = ["name", "contact", "avatarUrl", "id"];
		const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

		const en = {
			summary: "Set the account name and avatar shown when the Platform profile is unavailable.",
			title: "Account identity fallback",
			loading: "Loading settings…",
			unavailable: "Configuration is not available for this row.",
			readOnly: "This profile does not accept configuration writes.",
			nameLabel: "Account name",
			nameHint: "Shown in the account menu and Settings. Leave empty to use the last known Platform profile.",
			contactLabel: "Contact (optional)",
			contactHint: "Shown under the name in Settings → Account instead of the built-in placeholder. Leave empty to keep the placeholder.",
			avatarLabel: "Avatar",
			avatarHint: "Paste an image URL, or choose a local image file. The file is compressed, stored in the plugin data directory, and only a short reference is saved in the profile. Leave empty to use the last known Platform avatar.",
			avatarChoose: "Choose image…",
			replaceImage: "Replace image…",
			useLink: "Use a link instead",
			uploadedImage: "Uploaded image",
			avatarClear: "Remove image",
			idLabel: "Account id (optional)",
			idHint: "Used to prefill the Feedback form. Usually left empty.",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			noChanges: "Nothing to save",
			failed: "Could not save the settings",
			notImage: "Choose an image file",
			tooLarge: "The image is larger than 15 MB",
			readFailed: "Could not read the image file",
			cacheHint: "Empty fields fall back to the last known Platform profile, then to the built-in account label.",
		};

		const ru = {
			summary: "Имя и аватар аккаунта, когда профиль платформы недоступен.",
			title: "Имя и аватар аккаунта",
			loading: "Загрузка настроек…",
			unavailable: "Настройки для этой строки недоступны.",
			readOnly: "Этот профиль не принимает записи настроек.",
			nameLabel: "Имя в аккаунте",
			nameHint: "Показывается в меню аккаунта и настройках. Пусто — использовать последний известный профиль платформы.",
			contactLabel: "Контакт (необязательно)",
			contactHint: "Показывается под именем в Settings → Account вместо встроенной заглушки. Пусто — оставить заглушку.",
			avatarLabel: "Аватар",
			avatarHint: "Вставьте ссылку на изображение или выберите файл. Он сжимается, сохраняется в папке данных плагина, а в профиль пишется только короткая ссылка. Пусто — использовать последний известный аватар платформы.",
			avatarChoose: "Выбрать изображение…",
			replaceImage: "Заменить изображение…",
			useLink: "Вместо файла — ссылка",
			uploadedImage: "Загруженное изображение",
			avatarClear: "Убрать изображение",
			idLabel: "ID аккаунта (необязательно)",
			idHint: "Используется для предзаполнения формы Feedback. Обычно не заполняется.",
			save: "Сохранить",
			saving: "Сохранение…",
			saved: "Сохранено",
			noChanges: "Нечего сохранять",
			failed: "Не удалось сохранить настройки",
			notImage: "Выберите файл изображения",
			tooLarge: "Изображение больше 15 МБ",
			readFailed: "Не удалось прочитать файл изображения",
			cacheHint: "Пустые поля берут последний известный профиль платформы, а затем встроенную подпись аккаунта.",
		};

		const styles = {
			root: { display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0", fontSize: "13px", lineHeight: "20px" },
			grid: { display: "flex", flexDirection: "column", gap: "12px" },
			row: { display: "flex", flexDirection: "column", gap: "4px" },
			label: { color: "var(--dsw-alias-label-primary)", fontWeight: 500 },
			hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
			input: {
				boxSizing: "border-box", width: "100%", height: "32px", padding: "0 10px",
				color: "var(--dsw-alias-label-primary)", background: "var(--dsw-alias-bg-base)",
				border: "0.5px solid var(--dsw-alias-border-l2)", borderRadius: "var(--dsw-radius-md)", font: "inherit",
			},
			avatarRow: { display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" },
			avatar: {
				width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover",
				background: "var(--dsw-alias-bg-skeleton)", flex: "none",
			},
			uploaded: {
				display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "32px", padding: "0 10px",
				color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-skeleton)",
				border: "0.5px solid var(--dsw-alias-border-l2)", borderRadius: "var(--dsw-radius-md)",
			},
			uploadedSize: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px" },
			actions: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
			button: {
				height: "32px", padding: "0 14px", borderRadius: "var(--dsw-radius-md)",
				border: "0.5px solid var(--dsw-alias-border-l3)", background: "transparent",
				color: "var(--dsw-alias-label-primary)", font: "inherit", cursor: "pointer",
			},
			primary: {
				background: "var(--dsw-alias-button-primary-fill)", borderColor: "transparent",
				color: "var(--dsw-alias-label-primary-foreground)", fontWeight: 500,
			},
			ok: { color: "var(--dsw-alias-label-tertiary)" },
			fail: { color: "var(--dsw-alias-state-error-primary, #e5484d)" },
		};

		/** Read the form's current identity values into a plain draft object. */
		function draftFrom(snapshot) {
			const value = snapshot && snapshot.value && typeof snapshot.value === "object" ? snapshot.value : {};
			const draft = {};
			for (const field of FIELD_NAMES) {
				draft[field] = typeof value[field] === "string" ? value[field] : "";
			}
			return draft;
		}

		const AVATAR_REF_PREFIX = "dsh-file:";
		const AVATAR_ROUTE = "/account-identity-fallback/avatar";

		/** Whether a value is an embedded (legacy, inline) image URL. */
		function isInlineAvatar(value) {
			return typeof value === "string" && value.startsWith("data:");
		}

		/** Whether a value names a stored avatar file. */
		function isStoredAvatar(value) {
			return typeof value === "string" && value.startsWith(AVATAR_REF_PREFIX);
		}

		/** Approximate decoded size in KB of a data: URL. */
		function dataUrlSizeKb(value) {
			const comma = value.indexOf(",");
			const payload = comma === -1 ? "" : value.slice(comma + 1);
			const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
			return Math.max(1, Math.round((payload.length * 3) / 4 - padding) / 1024);
		}

		/** URL the browser can use as the avatar preview. */
		function avatarPreviewSource(value) {
			if (value === "") return undefined;
			if (isStoredAvatar(value)) return `${AVATAR_ROUTE}/${encodeURIComponent(value.slice(AVATAR_REF_PREFIX.length))}`;
			return value;
		}

		/** Downscale the chosen image to a small avatar and re-encode it. */
		function compressImage(dataUrl) {
			return new Promise((resolve) => {
				if (typeof Image !== "function" || typeof document === "undefined") {
					resolve(dataUrl);
					return;
				}
				const image = new Image();
				image.onload = () => {
					try {
						const scale = Math.min(1, 320 / Math.max(image.width, image.height));
						const width = Math.max(1, Math.round(image.width * scale));
						const height = Math.max(1, Math.round(image.height * scale));
						const canvas = document.createElement("canvas");
						canvas.width = width;
						canvas.height = height;
						const context = canvas.getContext("2d");
						if (context === null) {
							resolve(dataUrl);
							return;
						}
						context.drawImage(image, 0, 0, width, height);
						const encoded = canvas.toDataURL("image/webp", 0.85);
						resolve(encoded && encoded !== "data:," ? encoded : canvas.toDataURL("image/jpeg", 0.85));
					} catch (_error) {
						resolve(dataUrl);
					}
				};
				image.onerror = () => resolve(dataUrl);
				image.src = dataUrl;
			});
		}

		/** Store the compressed image on the Host and return its reference. */
		async function uploadAvatarData(dataUrl) {
			const response = await fetch(AVATAR_ROUTE, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ data: dataUrl }),
			});
			if (!response.ok) throw new Error(`avatar upload failed: ${response.status}`);
			const body = await response.json();
			if (typeof body?.ref !== "string" || !body.ref.startsWith(AVATAR_REF_PREFIX)) {
				throw new Error("avatar upload returned no reference");
			}
			return body.ref;
		}

		/** Render one label + control + hint block. */
		function fieldBlock(label, hint, control) {
			return h("label", { style: styles.row, key: label }, [
				h("span", { style: styles.label, key: "label" }, label),
				control,
				hint ? h("span", { style: styles.hint, key: "hint" }, hint) : null,
			]);
		}

		/** Configuration page rendered on the plugin's page in Plugins. */
		function ConfigPage(props) {
			const t = typeof props.t === "function" ? props.t : (key) => en[key] ?? key;
			const form = props.form;
			const [snapshot, setSnapshot] = React.useState(
				() => (form !== undefined && typeof form.getSnapshot === "function" ? form.getSnapshot() : undefined),
			);
			const [draft, setDraft] = React.useState(() => draftFrom(snapshot));
			const [saving, setSaving] = React.useState(false);
			const [notice, setNotice] = React.useState(null);
			const fileRef = React.useRef(null);
			const revision = snapshot ? snapshot.revision : undefined;

			React.useEffect(() => {
				if (form === undefined || typeof form.getSnapshot !== "function" || typeof form.subscribe !== "function") return undefined;
				const publish = () => setSnapshot(form.getSnapshot());
				publish();
				return form.subscribe(publish);
			}, [form]);

			React.useEffect(() => {
				setDraft(draftFrom(snapshot));
				setNotice(null);
			}, [revision]);

			if (props.view === "summary") return h("span", null, t("summary"));
			if (form === undefined || snapshot === undefined) return h("p", { style: styles.hint }, t("unavailable"));
			if (snapshot.status === "loading") return h("p", { style: styles.hint }, t("loading"));
			if (snapshot.status === "unavailable") return h("p", { style: styles.hint }, t("unavailable"));
			const writable = snapshot.writable === true;

			const setField = (field) => (event) => {
				const value = event.target.value;
				setDraft((previous) => ({ ...previous, [field]: value }));
			};

			const chooseFile = () => {
				if (fileRef.current !== null) fileRef.current.click();
			};

			const readFile = (event) => {
				const file = event.target.files && event.target.files[0];
				event.target.value = "";
				if (file === undefined) return;
				if (typeof file.type === "string" && file.type !== "" && !file.type.startsWith("image/")) {
					setNotice({ ok: false, text: t("notImage") });
					return;
				}
				if (file.size > MAX_SOURCE_BYTES) {
					setNotice({ ok: false, text: t("tooLarge") });
					return;
				}
				const reader = new FileReader();
				reader.onload = async () => {
					const original = String(reader.result || "");
					const compressed = await compressImage(original);
					try {
						const ref = await uploadAvatarData(compressed);
						setDraft((previous) => ({ ...previous, avatarUrl: ref }));
					} catch (_error) {
						// Older Host or non-Web carrier: keep the image inline.
						setDraft((previous) => ({ ...previous, avatarUrl: compressed }));
					}
					setNotice(null);
				};
				reader.onerror = () => setNotice({ ok: false, text: t("readFailed") });
				reader.readAsDataURL(file);
			};

			const save = async () => {
				if (saving || !writable) return;
				setSaving(true);
				setNotice(null);
				try {
					const before = draftFrom(snapshot);
					const ops = [];
					for (const field of FIELD_NAMES) {
						const next = String(draft[field] ?? "").trim();
						if (next === before[field]) continue;
						if (next === "") ops.push({ op: "unset", path: [field] });
						else ops.push({ op: "set", path: [field], value: next });
					}
					if (ops.length === 0) {
						setNotice({ ok: true, text: t("noChanges") });
						return;
					}
					const accepted = await form.mutate(ops, snapshot.revision);
					setNotice({ ok: accepted, text: t(accepted ? "saved" : "failed") });
				} catch (_error) {
					setNotice({ ok: false, text: t("failed") });
				} finally {
					setSaving(false);
				}
			};

			const avatarPreview = draft.avatarUrl === ""
				? null
				: h("img", {
					key: "preview",
					style: styles.avatar,
					src: avatarPreviewSource(draft.avatarUrl),
					alt: t("avatarLabel"),
					referrerPolicy: "no-referrer",
					onError: (event) => { event.currentTarget.style.visibility = "hidden"; },
					onLoad: (event) => { event.currentTarget.style.visibility = "visible"; },
				});

			return h("div", { style: styles.root, "data-account-identity-fallback": "" }, [
				!writable ? h("p", { style: styles.hint, key: "readonly" }, t("readOnly")) : null,
				h("div", { style: styles.grid, key: "grid" }, [
					fieldBlock(t("nameLabel"), t("nameHint"), h("input", {
						key: "name",
						style: styles.input,
						type: "text",
						value: draft.name,
						disabled: !writable || saving,
						onChange: setField("name"),
						placeholder: t("nameLabel"),
					})),
					fieldBlock(t("contactLabel"), t("contactHint"), h("input", {
						key: "contact",
						style: styles.input,
						type: "text",
						value: draft.contact,
						disabled: !writable || saving,
						onChange: setField("contact"),
						placeholder: t("contactLabel"),
					})),
					fieldBlock(t("avatarLabel"), t("avatarHint"), h("div", { style: styles.avatarRow, key: "avatar" }, [
						avatarPreview,
						(isStoredAvatar(draft.avatarUrl) || isInlineAvatar(draft.avatarUrl))
							? h("span", { key: "uploaded", style: styles.uploaded }, [
								h("span", { key: "label" }, t("uploadedImage")),
								isInlineAvatar(draft.avatarUrl)
									? h("span", { key: "size", style: styles.uploadedSize }, `${dataUrlSizeKb(draft.avatarUrl)} KB`)
									: null,
							])
							: h("input", {
								key: "avatar-url",
								style: { ...styles.input, flex: "1 1 240px" },
								type: "text",
								value: draft.avatarUrl,
								disabled: !writable || saving,
								onChange: setField("avatarUrl"),
								placeholder: "https://…",
							}),
						h("input", {
							key: "file",
							ref: fileRef,
							type: "file",
							accept: "image/*",
							style: { display: "none" },
							onChange: readFile,
						}),
						h("button", {
							key: "choose",
							type: "button",
							style: styles.button,
							disabled: !writable || saving,
							onClick: chooseFile,
						}, t((isStoredAvatar(draft.avatarUrl) || isInlineAvatar(draft.avatarUrl)) ? "replaceImage" : "avatarChoose")),
						(isStoredAvatar(draft.avatarUrl) || isInlineAvatar(draft.avatarUrl)) ? h("button", {
							key: "use-link",
							type: "button",
							style: styles.button,
							disabled: !writable || saving,
							onClick: () => setDraft((previous) => ({ ...previous, avatarUrl: "" })),
						}, t("useLink")) : null,
						draft.avatarUrl === "" ? null : h("button", {
							key: "clear",
							type: "button",
							style: styles.button,
							disabled: !writable || saving,
							onClick: () => setDraft((previous) => ({ ...previous, avatarUrl: "" })),
						}, t("avatarClear")),
					])),
					fieldBlock(t("idLabel"), t("idHint"), h("input", {
						key: "id",
						style: styles.input,
						type: "text",
						value: draft.id,
						disabled: !writable || saving,
						onChange: setField("id"),
						placeholder: t("idLabel"),
					})),
				]),
				h("div", { style: styles.actions, key: "actions" }, [
					h("button", {
						key: "save",
						type: "button",
						style: { ...styles.button, ...styles.primary },
						disabled: !writable || saving,
						onClick: save,
					}, t(saving ? "saving" : "save")),
					notice === null ? null : h("span", {
						key: "notice",
						style: notice.ok ? styles.ok : styles.fail,
						role: notice.ok ? "status" : "alert",
					}, notice.text),
				]),
				h("p", { style: styles.hint, key: "cache-hint" }, t("cacheHint")),
			]);
		}

		/** Required services: slot registry, locale dictionaries and configuration forms. */
		const inject = ["slots", "locale", "configForms"];

		/**
		 * Register the configuration page on the bundle's own page in Plugins.
		 * The page declares `plugins.bundle.config` without a form, so this
		 * plugin obtains the settings form for its row itself.
		 * @param ctx - browser plugin context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { en, ru }), "account-identity-fallback: dictionaries");
			const t = ctx.locale.bind(NS);
			const form = ctx.configForms.get(ROW_ID);
			ctx.effect(() => ctx.configForms.whileServed([ROW_ID], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: PACKAGE,
				locale: NS,
				inject: () => ({ t, form }),
			}, ConfigPage))), "account-identity-fallback: configuration page");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
