export type Messages = {
  locale: 'fa' | 'en';
  dir: 'rtl' | 'ltr';
  brand: string;
  brandLatin: string;
  tagline: string;
  nav: {
    search: string;
    browse: string;
    about: string;
    contribute: string;
  };
  theme: {
    toggle: string;
    light: string;
    dark: string;
  };
  langSwitch: {
    label: string;
    fa: string;
    en: string;
  };
  home: {
    title: string;
    description: string;
    trustLine: string;
    searchPlaceholder: string;
    searchHint: string;
    loading: string;
    empty: string;
    draft: string;
    both: string;
  };
  browse: {
    title: string;
    description: string;
    placeholder: string;
    loading: string;
    empty: string;
  };
  entry: {
    draftNote: string;
    senses: string;
    back: string;
  };
  about: {
    title: string;
    description: string;
    lead: string;
    sections: { heading: string; body: string }[];
    contributeLink: string;
    license: string;
  };
  contribute: {
    title: string;
    description: string;
    lead: string;
    ways: { title: string; body: string }[];
    cta: string;
    ctaNote: string;
  };
  footer: {
    developedBy: string;
    aytronic: string;
  };
};

export const fa: Messages = {
  locale: 'fa',
  dir: 'rtl',
  brand: 'توپراق',
  brandLatin: 'Topragh',
  tagline: 'فرهنگ ترکمنی ↔ فارسی و انگلیسی',
  nav: {
    search: 'جستجو',
    browse: 'مرور',
    about: 'درباره',
    contribute: 'مشارکت',
  },
  theme: {
    toggle: 'تغییر پوسته',
    light: 'روشن',
    dark: 'تیره',
  },
  langSwitch: {
    label: 'زبان',
    fa: 'فارسی',
    en: 'English',
  },
  home: {
    title: 'جستجو',
    description: 'معنی ترکمنی را به فارسی و انگلیسی، سریع و رایگان پیدا کنید.',
    trustLine: '۱۴٬۷۵۵ سرواژه · رایگان برای آموزش',
    searchPlaceholder: 'ترکمنی، فارسی یا انگلیسی بنویسید…',
    searchHint: 'جستجو بلافاصله روی همهٔ مدخل‌ها انجام می‌شود.',
    loading: 'در حال آماده‌سازی فهرست…',
    empty: 'نتیجه‌ای پیدا نشد. املا را کمی تغییر دهید یا حرف دیگری را امتحان کنید.',
    draft: 'پیش‌نویس',
    both: 'FA + EN',
  },
  browse: {
    title: 'مرور واژگان',
    description: 'سرواژه‌های ترکمنی را حرف‌به‌حرف ورق بزنید.',
    placeholder: 'یک حرف را انتخاب کنید.',
    loading: 'در حال بارگذاری…',
    empty: 'برای این حرف مدخلی نیست.',
  },
  entry: {
    draftNote: 'معنی فارسی هنوز پیش‌نویس است و ممکن است بازبینی شود.',
    senses: 'معانی',
    back: 'بازگشت به جستجو',
  },
  about: {
    title: 'درباره توپراق',
    description:
      'توپراق فرهنگ لغت ترکمنی به فارسی و انگلیسی است؛ سریع، شفاف و رایگان برای آموزش.',
    lead: 'توپراق جایی است برای پیدا کردن معنی واژه‌های ترکمنی — با فارسی و انگلیسی، بدون پیچیدگی.',
    sections: [
      {
        heading: 'توپراق چیست؟',
        body: 'یک فرهنگ آنلاین برای جستجو و مرور الفبایی. ترکمنی، فارسی یا انگلیسی بنویسید و سرواژهٔ ترکمنی را با معنی‌هایش ببینید.',
      },
      {
        heading: 'منبع داده‌ها',
        body: 'پایهٔ واژگان از فرهنگ ترکمنی–انگلیسی Peace Corps (۱۹۹۶–۱۹۹۹) است و برای آموزش آزاد در دسترس قرار گرفته است.',
      },
      {
        heading: 'دربارهٔ ترجمه‌های فارسی',
        body: 'معنی‌های فارسی ابتدا به‌صورت پیش‌نویس ماشینی آمده‌اند. آن‌ها را قدم‌به‌قدم بازبینی می‌کنیم و با کمک شما دقیق‌تر می‌شوند. هر جا برچسب «پیش‌نویس» دیدید، یعنی هنوز قطعی نیست.',
      },
      {
        heading: 'نگهداری',
        body: 'توپراق را شرکت Aytronic می‌سازد و نگه می‌دارد. اگر واژه‌ای بهتر می‌دانید یا غلطی دیدید، از صفحهٔ مشارکت با ما در میان بگذارید.',
      },
    ],
    contributeLink: 'رفتن به صفحهٔ مشارکت',
    license: 'استفادهٔ آموزشی آزاد است. فروش تجاری بدون اجازهٔ نویسندگان اصلی مجاز نیست.',
  },
  contribute: {
    title: 'مشارکت',
    description: 'با اصلاح ترجمه‌ها و پیشنهاد مدخل تازه، توپراق را دقیق‌تر کنید.',
    lead: 'اگر واژه‌ای را بهتر می‌شناسید، کمک شما اینجا معنا دارد — کوتاه، مشخص، و بدون دردسر.',
    ways: [
      {
        title: 'غلط املایی یا تایپی',
        body: 'املای سرواژه، معنی انگلیسی یا فارسی را اشتباه دیدید؟ همان را بفرستید.',
      },
      {
        title: 'ترجمهٔ بهتر فارسی',
        body: 'معنی پیش‌نویس را دقیق‌تر یا طبیعی‌تر می‌دانید؟ پیشنهادتان را بنویسید.',
      },
      {
        title: 'مدخل تازه',
        body: 'واژه‌ای دارید که در فهرست نیست؟ سرواژه، معنی انگلیسی و در صورت امکان فارسی را بفرستید.',
      },
    ],
    cta: 'گزارش در گیت‌هاب',
    ctaNote: 'پیام کوتاه کافی است: واژه، مشکل، و پیشنهادتان.',
  },
  footer: {
    developedBy: 'ساخته‌شده توسط',
    aytronic: 'Aytronic',
  },
};
