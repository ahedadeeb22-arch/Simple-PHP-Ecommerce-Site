const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for product images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Session storage in memory
const sessions = new Map();

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Default login as Admin as requested ("وادخلني ك ادمن")
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  let sessionId = cookies['merashop_sid'];
  
  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = crypto.randomBytes(16).toString('hex');
    // Default session: Logged in as Admin!
    sessions.set(sessionId, {
      user_id: 1,
      username: 'admin',
      role: 'admin',
      name: 'المدير العام'
    });
    res.setHeader('Set-Cookie', `merashop_sid=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
  }
  
  req.session = sessions.get(sessionId);
  
  // Make current session available to all templates
  res.locals.currentUser = req.session;
  
  req.destroySession = () => {
    sessions.delete(sessionId);
    res.setHeader('Set-Cookie', `merashop_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  };
  next();
});

// Seed Database in Arabic
const db = {
  users: [
    {
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      name: 'المدير العام'
    },
    {
      id: 2,
      username: 'user',
      password: bcrypt.hashSync('user123', 10),
      role: 'user',
      name: 'المشتري أحمد'
    }
  ],
  categories: [
    { id: 1, name: 'إلكترونيات وأجهزة ذكية' },
    { id: 2, name: 'أزياء وملابس رجالية ونسائية' },
    { id: 3, name: 'ساعات وإكسسوارات' }
  ],
  products: [
    {
      id: 1,
      title: 'حاسوب محمول فائق الأداء (Pro Laptop)',
      description: 'لابتوب احترافي للأعمال والألعاب بمعالج فائق السرعة، ذاكرة رام 16 جيجابايت، شاشة Retina عالية الدقة 4K وعمر بطارية يدوم طوال اليوم.',
      price: 4500,
      offer: 3899,
      category_id: 1,
      image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 2,
      title: 'قميص قطني كلاسيكي فاخر',
      description: 'قميص قطن طبيعي 100% مريح للغاية، مقاوم للتجاعيد، تصميم أنيق وعصري مناسب للعمل والمناسبات اليومية.',
      price: 180,
      offer: 129,
      category_id: 2,
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 3,
      title: 'سماعات رأس لاسلكية بخاصية عزل الضوضاء',
      description: 'تجربة صوتية نقية بتقنية الصوت المحيطي وعزل الضوضاء النشط، مع ميكروفون مدمج وبطارية تدوم حتى 40 ساعة تشغيل.',
      price: 750,
      offer: 599,
      category_id: 1,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80'
    },
    {
      id: 4,
      title: 'ساعة ذكية رياضية متطورة',
      description: 'مقاومة للماء وتدعم تتبع نبضات القلب والنشاط الرياضي، شاشة AMOLED ملونة، ونظام تحديد المواقع GPS مدمج.',
      price: 890,
      offer: 699,
      category_id: 3,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80'
    }
  ],
  cart: [
    {
      id: 1,
      user_id: 2,
      product_id: 1,
      quantity: 1
    }
  ],
  nextCategoryId: 4,
  nextProductId: 5,
  nextCartId: 2
};

// Helper for resolving images
app.locals.resolveImage = (imagePath) => {
  if (!imagePath) return 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  if (imagePath.startsWith('/')) {
    return imagePath;
  }
  return '/' + imagePath;
};

// Quick switch role route for user convenience
app.get('/switch-role', (req, res) => {
  const targetRole = req.query.role === 'user' ? 'user' : 'admin';
  const targetUser = db.users.find(u => u.role === targetRole);
  if (targetUser) {
    req.session.user_id = targetUser.id;
    req.session.role = targetUser.role;
    req.session.username = targetUser.username;
    req.session.name = targetUser.name;
  }
  if (targetRole === 'admin') {
    res.redirect('/admin/index.php');
  } else {
    res.redirect('/products.php');
  }
});

// Authentication middleware
function requireLogin(req, res, next) {
  if (!req.session || !req.session.user_id) {
    return res.redirect('/login.php');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.redirect('/login.php');
  }
  next();
}

// 1. Root Route
app.get(['/', '/index.php'], (req, res) => {
  if (req.session && req.session.role === 'admin') {
    return res.redirect('/admin/index.php');
  } else if (req.session && req.session.user_id) {
    return res.redirect('/products.php');
  } else {
    return res.redirect('/login.php');
  }
});

// 2. Login Routes (Arabic)
app.get(['/login', '/login.php'], (req, res) => {
  res.render('login', { error: null });
});

app.post(['/login', '/login.php'], (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find((u) => u.username === username);

  if (user && bcrypt.compareSync(password || '', user.password)) {
    req.session.user_id = user.id;
    req.session.role = user.role;
    req.session.username = user.username;
    req.session.name = user.name;
    if (user.role === 'admin') {
      return res.redirect('/admin/index.php');
    } else {
      return res.redirect('/products.php');
    }
  } else {
    res.render('login', { error: 'بيانات الدخول غير صحيحة! يرجى التحقق من اسم المستخدم وكلمة المرور.' });
  }
});

// 3. Logout Route
app.get(['/logout', '/logout.php'], (req, res) => {
  req.destroySession();
  res.redirect('/login.php');
});

// 4. Products Listing (Arabic)
app.get(['/products', '/products.php'], (req, res) => {
  const categories = db.categories;
  const selected_category = req.query.category_id ? Number(req.query.category_id) : null;
  const products = selected_category
    ? db.products.filter((p) => Number(p.category_id) === selected_category)
    : db.products;

  // Count items in user's cart
  const userCartCount = db.cart
    .filter(c => c.user_id === (req.session ? req.session.user_id : 1))
    .reduce((sum, item) => sum + item.quantity, 0);

  res.render('products', {
    categories,
    selected_category,
    products,
    userCartCount,
    successMsg: req.query.added ? 'تمت إضافة المنتج إلى سلة المشتريات بنجاح!' : null
  });
});

// 5. Product Details (Arabic)
app.get(['/product_details', '/product_details.php'], (req, res) => {
  const productId = Number(req.query.id);
  const rawProduct = db.products.find((p) => p.id === productId);

  if (!rawProduct) {
    return res.redirect('/products.php');
  }

  const category = db.categories.find((c) => c.id === Number(rawProduct.category_id));
  const product = {
    ...rawProduct,
    category_name: category ? category.name : 'عام'
  };

  const related_products = db.products
    .filter((p) => Number(p.category_id) === Number(rawProduct.category_id) && p.id !== productId)
    .slice(0, 3);

  const userCartCount = db.cart
    .filter(c => c.user_id === (req.session ? req.session.user_id : 1))
    .reduce((sum, item) => sum + item.quantity, 0);

  res.render('product_details', {
    product,
    related_products,
    userCartCount,
    successMsg: req.query.added ? 'تمت إضافة المنتج إلى السلة بنجاح!' : null
  });
});

// 6. Cart Action (Arabic)
app.get(['/cart', '/cart.php'], (req, res) => {
  const user_id = req.session ? req.session.user_id : 1;
  const action = req.query.action;
  const product_id = Number(req.query.product_id);

  if (action === 'add' && product_id) {
    const existing = db.cart.find(
      (item) => item.user_id === user_id && item.product_id === product_id
    );
    if (existing) {
      existing.quantity += 1;
    } else {
      db.cart.push({
        id: db.nextCartId++,
        user_id,
        product_id,
        quantity: 1
      });
    }
  }

  if (req.query.redirect === 'details') {
    return res.redirect(`/product_details.php?id=${product_id}&added=1`);
  }
  res.redirect('/products.php?added=1');
});

// 7. View Cart (Arabic)
app.get(['/view_cart', '/view_cart.php'], (req, res) => {
  const user_id = req.session ? req.session.user_id : 1;

  if (req.query.action === 'remove' && req.query.cart_id) {
    const cartId = Number(req.query.cart_id);
    db.cart = db.cart.filter((item) => !(item.id === cartId && item.user_id === user_id));
    return res.redirect('/view_cart.php');
  }

  const cart_items = db.cart
    .filter((c) => c.user_id === user_id)
    .map((c) => {
      const p = db.products.find((prod) => prod.id === c.product_id);
      if (!p) return null;
      return {
        ...c,
        title: p.title,
        price: p.price,
        offer: p.offer,
        image: p.image
      };
    })
    .filter(Boolean);

  let total = 0;
  for (const item of cart_items) {
    total += Number(item.offer) * Number(item.quantity);
  }

  res.render('view_cart', {
    cart_items,
    total
  });
});

// 8. Admin: Dashboard / Add Product (Arabic)
app.get(['/admin', '/admin/', '/admin/index.php', '/admin/add_product.php'], requireAdmin, (req, res) => {
  const stats = {
    totalProducts: db.products.length,
    totalCategories: db.categories.length,
    totalCartItems: db.cart.length
  };
  res.render('admin/add_product', {
    categories: db.categories,
    stats,
    successMsg: req.query.success ? 'تمت إضافة المنتج بنجاح إلى المتجر!' : null
  });
});

app.post(['/admin/index.php', '/admin/add_product.php'], requireAdmin, upload.single('image'), (req, res) => {
  const { title, description, price, offer, category_id, image_url } = req.body;
  let image_path = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
  
  if (req.file) {
    image_path = `/uploads/${req.file.filename}`;
  } else if (image_url && image_url.trim()) {
    image_path = image_url.trim();
  }

  db.products.push({
    id: db.nextProductId++,
    title: title.trim(),
    description: description.trim(),
    price: Number(price),
    offer: Number(offer),
    category_id: Number(category_id),
    image: image_path
  });

  res.redirect('/admin/manage_products.php?success=added');
});

// 9. Admin: Manage Products (Arabic)
app.get(['/admin/manage_products', '/admin/manage_products.php'], requireAdmin, (req, res) => {
  if (req.query.action === 'delete' && req.query.id) {
    const id = Number(req.query.id);
    db.products = db.products.filter((p) => p.id !== id);
    db.cart = db.cart.filter((c) => c.product_id !== id);
    return res.redirect('/admin/manage_products.php?success=deleted');
  }

  const products = db.products.map((p) => {
    const cat = db.categories.find((c) => c.id === Number(p.category_id));
    return {
      ...p,
      category_name: cat ? cat.name : 'غير مصنف'
    };
  });

  let message = null;
  if (req.query.success === 'added') message = 'تمت إضافة المنتج بنجاح!';
  if (req.query.success === 'updated') message = 'تم تحديث بيانات المنتج بنجاح!';
  if (req.query.success === 'deleted') message = 'تم حذف المنتج بنجاح!';

  res.render('admin/manage_products', {
    products,
    categories: db.categories,
    message
  });
});

app.post(['/admin/manage_products', '/admin/manage_products.php'], requireAdmin, upload.single('image'), (req, res) => {
  const { id, title, description, price, offer, category_id, image_url } = req.body;
  const product = db.products.find((p) => p.id === Number(id));

  if (product) {
    product.title = title.trim();
    product.description = description.trim();
    product.price = Number(price);
    product.offer = Number(offer);
    product.category_id = Number(category_id);
    if (req.file) {
      product.image = `/uploads/${req.file.filename}`;
    } else if (image_url && image_url.trim()) {
      product.image = image_url.trim();
    }
  }

  res.redirect('/admin/manage_products.php?success=updated');
});

// 10. Admin: Add/Delete Categories (Arabic)
app.get(['/admin/add_category', '/admin/add_category.php'], requireAdmin, (req, res) => {
  if (req.query.action === 'delete' && req.query.id) {
    const id = Number(req.query.id);
    db.categories = db.categories.filter((c) => c.id !== id);
    return res.redirect('/admin/add_category.php?success=deleted');
  }

  let message = null;
  if (req.query.success === 'added') message = 'تمت إضافة القسم الجديد بنجاح!';
  if (req.query.success === 'deleted') message = 'تم حذف القسم بنجاح!';

  res.render('admin/add_category', {
    categories: db.categories,
    message
  });
});

app.post(['/admin/add_category', '/admin/add_category.php'], requireAdmin, (req, res) => {
  const { name } = req.body;
  if (name && name.trim()) {
    db.categories.push({
      id: db.nextCategoryId++,
      name: name.trim()
    });
  }
  res.redirect('/admin/add_category.php?success=added');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ متجر ميرا يعمل بنجاح على http://0.0.0.0:${PORT}`);
});
