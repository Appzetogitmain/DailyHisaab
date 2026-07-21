import Joi from 'joi';



// Login Schema - for existing users only
const loginWithMobileSchema = Joi.object({
    mobile: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.pattern.base': 'mobile number must be exactly 10 digits',
            'any.required': 'mobile number is required',
            'string.empty': 'mobile number cannot be empty'
        }),

    phone_code: Joi.string()
        .pattern(/^\+[0-9]{1,4}$/)
        .required()
        .messages({
            'string.pattern.base': 'phone_code must start with + followed by 1-4 digits',
            'any.required': 'phone_code is required',
            'string.empty': 'phone_code cannot be empty'
        }),

    player_id: Joi.string()
        .min(1)
        .required()
        .messages({
            'any.required': 'player_id is required',
            'string.empty': 'player_id cannot be empty',
            'string.min': 'player_id must not be empty'
        }),

    device_type: Joi.string()
        .valid('android', 'ios')
        .required()
        .messages({
            'any.only': 'device_type must be android or ios',
            'any.required': 'device_type is required'
        }),

    user_type: Joi.alternatives().try(
        Joi.string().valid('1', '2'),
        Joi.number().integer().valid(1, 2)
    ).required().messages({
        'any.only': 'User type must be 1 (User) or 2 (Manager)',
        'any.required': 'User type is required',
        'alternatives.match': 'User type must be 1 or 2'
    }),

    name: Joi.string()
        .max(255)
        .allow(null, '')
        .optional()
        .messages({
            'string.max': 'Name must not exceed 255 characters',
            'string.empty': 'Name cannot be empty string'
        }),

    email: Joi.string()
        .email()
        .max(255)
        .allow(null, '')
        .optional()
        .messages({
            'string.email': 'Email must be a valid email address',
            'string.max': 'Email must not exceed 255 characters',
            'string.empty': 'Email cannot be empty string'
        })
});

// Signup Schema - for new users only
const signUpWithMobileSchema = Joi.object({
    mobile: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.pattern.base': 'mobile number must be exactly 10 digits',
            'any.required': 'mobile number is required',
            'string.empty': 'mobile number cannot be empty'
        }),

    phone_code: Joi.string()
        .pattern(/^\+[0-9]{1,4}$/)
        .required()
        .messages({
            'string.pattern.base': 'phone_code must start with + followed by 1-4 digits',
            'any.required': 'phone_code is required',
            'string.empty': 'phone_code cannot be empty'
        }),

    player_id: Joi.string()
        .min(1)
        .required()
        .messages({
            'any.required': 'player_id is required',
            'string.empty': 'player_id cannot be empty',
            'string.min': 'player_id must not be empty'
        }),

    device_type: Joi.string()
        .valid('android', 'ios')
        .required()
        .messages({
            'any.only': 'device_type must be android or ios',
            'any.required': 'device_type is required'
        }),

    user_type: Joi.alternatives().try(
        Joi.string().valid('1', '2'),
        Joi.number().integer().valid(1, 2)
    ).required().messages({
        'any.only': 'User type must be 1 (User) or 2 (Manager)',
        'any.required': 'User type is required',
        'alternatives.match': 'User type must be 1 or 2'
    }),

    name: Joi.string()
        .max(255)
        .allow(null, '')
        .optional()
        .messages({
            'string.max': 'Name must not exceed 255 characters',
            'string.empty': 'Name cannot be empty string'
        }),

    email: Joi.string()
        .email()
        .max(255)
        .allow(null, '')
        .optional()
        .messages({
            'string.email': 'Email must be a valid email address',
            'string.max': 'Email must not exceed 255 characters',
            'string.empty': 'Email cannot be empty string'
        }),

    state: Joi.string()
        .max(100)
        .allow(null, '')
        .optional()
        .messages({
            'string.max': 'State must not exceed 100 characters'
        }),

    source: Joi.string()
        .max(50)
        .allow(null, '')
        .optional(),

    medium: Joi.string()
        .max(50)
        .allow(null, '')
        .optional(),

    campaign: Joi.string()
        .max(100)
        .allow(null, '')
        .optional()
});





const resendOtpSchema = Joi.object({
    mobile: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .required()
        .messages({
            'string.pattern.base': 'mobile number must be exactly 10 digits',
            'any.required': 'mobile number is required',
            'string.empty': 'mobile number cannot be empty'
        }),

    phone_code: Joi.string()
        .pattern(/^\+[0-9]{1,4}$/)
        .required()
        .messages({
            'string.pattern.base': 'phone_code must start with + followed by 1-4 digits',
            'any.required': 'phone_code is required',
            'string.empty': 'phone_code cannot be empty'
        }),

    user_type: Joi.number().integer().valid(0, 1).optional().messages({
        'number.base': 'user_type must be a number',
        'number.integer': 'user_type must be an integer',
        'any.only': 'user_type must be 0 (Manager) or 1 (User)'
    }),

    account_type: Joi.string().valid('1', '2', '3').optional().messages({
        'any.only': 'account_type must be 1 (Personal), 2 (Business), or 3 (Freelance)'

    }),

    account_id: Joi.number().integer().positive().optional().messages({

        'number.base': 'account_id must be a number',

        'number.integer': 'account_id must be an integer',

        'number.positive': 'account_id must be positive'

    })



});



const getAllCategorySchema = Joi.object({



    user_id: Joi.number().integer().positive().required().messages({



        'number.base': 'user_id must be a number',



        'number.integer': 'user_id must be an integer',



        'number.positive': 'user_id must be positive',



        'any.required': 'user_id is required'



    }),



    account_type: Joi.number().integer().valid(1, 2, 3).optional().messages({



        'number.base': 'account_type must be a number',



        'number.integer': 'account_type must be an integer',



        'any.only': 'account_type must be 1 (Personal) or 2 (Business)'



    }),

    account_id: Joi.number().integer().positive().optional().messages({

        'number.base': 'account_id must be a number',

        'number.integer': 'account_id must be an integer',

        'number.positive': 'account_id must be positive'

    })



});



const otpVerifySchema = Joi.object({



    user_id: Joi.number().integer().positive().required().messages({



        'number.base': 'user_id must be a number',



        'number.integer': 'user_id must be an integer',



        'number.positive': 'user_id must be positive',



        'any.required': 'user_id is required'



    }),



    otp: Joi.string().pattern(/^[0-9]{4,6}$/).required().messages({



        'string.pattern.base': 'otp must be 4-6 digits',



        'any.required': 'otp is required',



        'string.empty': 'otp cannot be empty'



    })



});



const contactUsSchema = Joi.object({



    user_id: Joi.number().integer().positive().required().messages({



        'number.base': 'user_id must be a number',



        'number.integer': 'user_id must be an integer',



        'number.positive': 'user_id must be positive',



        'any.required': 'user_id is required'



    }),



    user_type: Joi.string().valid('1', '2').required().messages({



        'any.only': 'user_type must be 1 or 2',



        'any.required': 'user_type is required'



    }),



    name: Joi.string().min(2).max(100).required().messages({



        'string.min': 'name must be at least 2 characters',



        'string.max': 'name must be at most 100 characters',



        'any.required': 'name is required'



    }),



    email: Joi.string().email().required().messages({



        'string.email': 'email must be a valid email address',



        'any.required': 'email is required'



    }),



    message: Joi.string().min(1).max(1000).required().messages({



        'string.empty': 'message cannot be empty',



        'string.max': 'message must be at most 1000 characters',



        'any.required': 'message is required'



    })



});

// Public Contact Us Schema (no authentication required)
const publicContactUsSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'name must be at least 2 characters',
        'string.max': 'name must be at most 100 characters',
        'any.required': 'name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    subject: Joi.string().min(2).max(200).required().messages({
        'string.min': 'subject must be at least 2 characters',
        'string.max': 'subject must be at most 200 characters',
        'any.required': 'subject is required'
    }),
    message: Joi.string().min(1).max(1000).required().messages({
        'string.empty': 'message cannot be empty',
        'string.max': 'message must be at most 1000 characters',
        'any.required': 'message is required'
    }),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional().messages({
        'string.pattern.base': 'phone must be a 10-digit number'
    })
});



const deleteAccountSchema = Joi.object({



    user_id: Joi.number().integer().positive().required().messages({



        'number.base': 'user_id must be a number',



        'number.integer': 'user_id must be an integer',



        'number.positive': 'user_id must be positive',



        'any.required': 'user_id is required'



    }),



    reason: Joi.string().min(2).max(255).required().messages({



        'string.min': 'reason must be at least 2 characters',



        'string.max': 'reason must be at most 255 characters',



        'any.required': 'reason is required'



    })



});

const createProfileSchema = Joi.object({

    user_id: Joi.number().integer().positive().required().messages({

        'number.base': 'user_id must be a number',

        'number.integer': 'user_id must be an integer',

        'number.positive': 'user_id must be positive',

        'any.required': 'user_id is required'

    }),

    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'name must be at least 2 characters',
        'string.max': 'name must be at most 100 characters',
        'any.required': 'name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    DOB: Joi.date().less('now').required().messages({
        'date.base': "DOB must be a valid date",
        'date.less': "DOB must be in the past",
        'any.required': "DOB is required"
    }),

    gender: Joi.string().valid('1', '2', '3').required().messages({

        'any.only': "gender must be one of '1', '2', or '3'",

        'any.required': "gender is required"

    }),

    mobile: Joi.string().pattern(/^[0-9]{10}$/).required().messages({

        'string.pattern.base': 'mobile must be a 10-digit number',

        'any.required': 'mobile is required'

    }),

    state: Joi.string()
        .max(100)
        .allow(null, '')
        .optional()
        .messages({
            'string.max': 'State must not exceed 100 characters'
        })

});



const validateAppLock = Joi.object({

    user_id: Joi.number().integer().positive().required().messages({

        'number.base': 'user_id must be a number',

        'number.integer': 'user_id must be an integer',

        'number.positive': 'user_id must be positive',

        'any.required': 'user_id is required'

    }),

    app_lock_code: Joi.string().pattern(/^[0-9]{4}$/).required().messages({

        'string.pattern.base': 'app_lock_code must be 4 digits',

        'any.required': 'app_lock_code is required'

    })

});



const addCategorySchema = Joi.object({

    category_name: Joi.string().min(1).required().messages({

        'string.base': 'Category name must be a string',

        'string.empty': 'Category name is required',

        'any.required': 'Category name is required'

    }),

    user_id: Joi.number().integer().positive().required().messages({

        'number.base': 'user_id must be a number',

        'number.integer': 'user_id must be an integer',

        'number.positive': 'user_id must be positive',

        'any.required': 'user_id is required'

    }),

    category_type: Joi.string().valid('1', '2').required().messages({

        'any.only': 'category_type must be 1 or 2',

        'any.required': 'category_type is required'

    }),

    account_type: Joi.string().valid('1', '2').required().messages({

        'any.only': 'account_type must be 1 (Personal) or 2 (Business)',

        'any.required': 'account_type is required'

    }),

    account_id: Joi.number().integer().positive().optional().messages({

        'number.base': 'account_id must be a number',

        'number.integer': 'account_id must be an integer',

        'number.positive': 'account_id must be positive'

    })

});



const categoryEditSchema = Joi.object({

    category_id: Joi.number().integer().positive().required().messages({

        'any.required': 'category_id is required'

    }),

    category_name: Joi.string().min(1).required().messages({

        'string.empty': 'Category name is required'

    }),

    user_id: Joi.number().integer().positive().required().messages({

        'any.required': 'user_id is required'

    }),

    category_type: Joi.string().valid('1', '2').required().messages({

        'any.only': 'category_type must be 1 or 2',

        'any.required': 'category_type is required'

    }),

    account_type: Joi.string().valid('1', '2').required().messages({

        'any.only': 'account_type must be 1 (Personal) or 2 (Business)',

        'any.required': 'account_type is required'

    }),

    account_id: Joi.number().integer().positive().optional().messages({

        'number.base': 'account_id must be a number',

        'number.integer': 'account_id must be an integer',

        'number.positive': 'account_id must be positive'

    })

});



const categoryDeleteSchema = Joi.object({

    category_id: Joi.number().integer().positive().required().messages({

        'any.required': 'category_id is required'

    }),

    user_id: Joi.number().integer().positive().required().messages({

        'any.required': 'user_id is required'

    })

});



const addTeamMemberSchema = Joi.object({

    user_id: Joi.number().integer().positive().required().messages({

        'any.required': 'user_id is required'

    }),

    name: Joi.string().min(2).max(100).required().messages({

        'string.min': 'name must be at least 2 characters',

        'string.max': 'name must be at most 100 characters',



        'any.required': 'name is required'

    }),

    mobile: Joi.string().pattern(/^[0-9]{10}$/).required().messages({

        'string.pattern.base': 'mobile must be a 10-digit number',

        'any.required': 'mobile is required'

    }),

    phone_code: Joi.string().pattern(/^\+[0-9]{1,4}$/).required().messages({

        'string.pattern.base': 'phone_code must start with + followed by 1-4 digits',

        'any.required': 'phone_code is required',

        'string.empty': 'phone_code cannot be empty'

    }),

    role: Joi.string().min(2).max(100).required().messages({

        'string.min': 'role must be at least 2 characters',

        'string.max': 'role must be at most 100 characters',

        'any.required': 'role is required'

    }),

    account_type: Joi.string().valid('1', '2').required().messages({

        'any.only': 'account_type must be 1 or 2 or 3',

        'any.required': 'account_type is required'

    })

})



const editTeamMemberSchema = Joi.object({

    user_id: Joi.number().integer().positive().required().messages({

        'any.required': 'user_id is required'

    }),

    name: Joi.string().min(2).max(100).required().messages({

        'string.min': 'name must be at least 2 characters',

        'string.max': 'name must be at most 100 characters',



        'any.required': 'name is required'

    }),

    mobile: Joi.string().pattern(/^[0-9]{10}$/).required().messages({

        'string.pattern.base': 'mobile must be a 10-digit number',

        'any.required': 'mobile is required'

    }),

    phone_code: Joi.string().pattern(/^\+[0-9]{1,4}$/).required().messages({

        'string.pattern.base': 'phone_code must start with + followed by 1-4 digits',

        'any.required': 'phone_code is required',

        'string.empty': 'phone_code cannot be empty'

    }),

    role: Joi.string().min(2).max(100).required().messages({

        'string.min': 'role must be at least 2 characters',

        'string.max': 'role must be at most 100 characters',

        'any.required': 'role is required'

    }),

    account_type: Joi.string().valid('1', '2', '3').required().messages({

        'any.only': 'account_type must be 1 or 2 or 3',

        'any.required': 'account_type is required'

    }),

    team_member_id: Joi.number().integer().positive().required().messages({

        'any.required': 'team_member_id is required'

    })

});



const faqSchema = Joi.object({



    user_id: Joi.number().integer().positive().required().messages({



        'number.base': 'user_id must be a number',



        'number.integer': 'user_id must be an integer',



        'number.positive': 'user_id must be positive',



        'any.required': 'user_id is required'



    }),

    faq_type: Joi.string().valid('0', '1', '2', '3', '4', '5', '6', '7', '8').required().messages({

        'any.only': 'faq_type must be 0 or 1 or 2 or 3 or 4 or 5 or 6 or 7 or 8',

        'any.required': 'faq_type is required'

    })



});

const customerEditSchema = Joi.object({
    udhari_customer_id: Joi.number().integer().positive().required().messages({
        'number.base': 'udhari_customer_id must be a number',
        'number.integer': 'udhari_customer_id must be an integer',
        'number.positive': 'udhari_customer_id must be positive',
        'any.required': 'udhari_customer_id is required'
    }),
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    customer_name: Joi.string().min(1).required().messages({
        'string.base': 'customer_name must be a string',
        'string.empty': 'customer_name is required',
        'any.required': 'customer_name is required'
    }),
    description: Joi.string().min(1).required().messages({
        'string.base': 'description must be a string',
        'string.empty': 'description is required',
        'any.required': 'description is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    })
});

const customerDeleteSchema = Joi.object({
    udhari_customer_id: Joi.number().integer().positive().required().messages({
        'number.base': 'udhari_customer_id must be a number',
        'number.integer': 'udhari_customer_id must be an integer',
        'number.positive': 'udhari_customer_id must be positive',
        'any.required': 'udhari_customer_id is required'
    }),
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    })
});

const addOpeningStockSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    }),
    opening_stock: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'opening_stock must be a number',
        'number.min': 'opening_stock must be 0 or greater',
        'any.required': 'opening_stock is required'
    })
});

const addPurchaseStockSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    }),
    stock_id: Joi.number().integer().positive().required().messages({
        'number.base': 'stock_id must be a number',
        'number.integer': 'stock_id must be an integer',
        'number.positive': 'stock_id must be positive',
        'any.required': 'stock_id is required'
    }),
    purchase_date: Joi.date().less('now').required().messages({
        'date.base': 'purchase_date must be a valid date',
        'date.less': 'purchase_date must be in the past',
        'any.required': 'purchase_date is required'
    }),
    purchase_amount: Joi.number().precision(2).min(0).required().messages({
        'number.base': 'purchase_amount must be a number',
        'number.min': 'purchase_amount must be 0 or greater',
        'any.required': 'purchase_amount is required'
    })
});

// Admin Registration Schema
const adminRegisterSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(20).required().messages({
        'string.base': 'username must be a string',
        'string.alphanum': 'username must only contain alpha-numeric characters',
        'string.min': 'username must be at least 3 characters long',
        'string.max': 'username cannot exceed 20 characters',
        'any.required': 'username is required'
    }),
    email: Joi.string().email().required().messages({
        'string.base': 'email must be a string',
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.base': 'password must be a string',
        'string.min': 'password must be at least 6 characters long',
        'any.required': 'password is required'
    })
});

// Admin Login Schema
const adminLoginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.base': 'email must be a string',
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    password: Joi.string().required().messages({
        'string.base': 'password must be a string',
        'any.required': 'password is required'
    })
});

// Admin Category Management Schemas
const adminCreateCategorySchema = Joi.object({
    category_name: Joi.string().min(1).max(100).required().messages({
        'string.base': 'category_name must be a string',
        'string.empty': 'category_name is required',
        'string.min': 'category_name must be at least 1 character',
        'string.max': 'category_name must be at most 100 characters',
        'any.required': 'category_name is required'
    }),
    category_type: Joi.number().integer().valid(1, 2).required().messages({
        'number.base': 'category_type must be a number',
        'number.integer': 'category_type must be an integer',
        'any.only': 'category_type must be 1 (Expense) or 2 (Income)',
        'any.required': 'category_type is required'
    }),
    account_type: Joi.number().integer().valid(1, 2, 3).required().messages({
        'number.base': 'account_type must be a number',
        'number.integer': 'account_type must be an integer',
        'any.only': 'account_type must be 1 (Personal) or 2 (Business)',
        'any.required': 'account_type is required'
    }),
    deletable: Joi.any().optional().default(0).messages({
        'any.only': 'deletable must be 0 (not deletable) or 1 (deletable)'
    })
});

const adminUpdateCategorySchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'category_id must be a number',
        'number.integer': 'category_id must be an integer',
        'number.positive': 'category_id must be positive',
        'any.required': 'category_id is required'
    }),
    category_name: Joi.string().min(1).max(100).required().messages({
        'string.base': 'category_name must be a string',
        'string.empty': 'category_name is required',
        'string.min': 'category_name must be at least 1 character',
        'string.max': 'category_name must be at most 100 characters',
        'any.required': 'category_name is required'
    }),
    category_type: Joi.number().integer().valid(1, 2).required().messages({
        'number.base': 'category_type must be a number',
        'number.integer': 'category_type must be an integer',
        'any.only': 'category_type must be 1 (Expense) or 2 (Income)',
        'any.required': 'category_type is required'
    }),
    account_type: Joi.number().integer().valid(1, 2, 3).optional().default(1).messages({
        'number.base': 'account_type must be a number',
        'number.integer': 'account_type must be an integer',
        'any.only': 'account_type must be 1 (Personal) or 2 (Business)'
    }),
    deletable: Joi.any().optional().default(0).messages({
        'any.only': 'deletable must be 0 (not deletable) or 1 (deletable)'
    })
});

const adminDeleteCategorySchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'category_id must be a number',
        'number.integer': 'category_id must be an integer',
        'number.positive': 'category_id must be positive',
        'any.required': 'category_id is required'
    })
});

// Weekly Graph Data Schema
const weeklyGraphDataSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    })
});

// Monthly Graph Data Schema
const monthlyGraphDataSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    }),
    month: Joi.number().integer().min(1).max(12).required().messages({
        'number.base': 'month must be a number',
        'number.integer': 'month must be an integer',
        'number.min': 'month must be between 1 and 12',
        'number.max': 'month must be between 1 and 12',
        'any.required': 'month is required'
    }),
    year: Joi.number().integer().min(2020).max(2030).required().messages({
        'number.base': 'year must be a number',
        'number.integer': 'year must be an integer',
        'number.min': 'year must be between 2020 and 2030',
        'number.max': 'year must be between 2020 and 2030',
        'any.required': 'year is required'
    })
});

// Admin Payment History Validation Schema
const adminPaymentHistorySchema = Joi.object({
    page: Joi.number().integer().min(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
    }),
    status: Joi.string().valid('all', 'paid', 'pending', 'failed').optional().messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: all, paid, pending, failed'
    }),
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'User ID must be a number',
        'number.integer': 'User ID must be an integer',
        'number.positive': 'User ID must be positive'
    }),
    start_date: Joi.date().iso().optional().messages({
        'date.format': 'Start date must be in YYYY-MM-DD format'
    }),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
        'date.format': 'End date must be in YYYY-MM-DD format',
        'date.min': 'End date must be after start date'
    }),
    subscription_type: Joi.string().valid('all', '1', '2').optional().messages({
        'string.base': 'Subscription type must be a string',
        'any.only': 'Subscription type must be one of: all, 1 (Yearly), 2 (Monthly)'
    })
});

// Admin User Subscription History Validation Schema
const adminUserSubscriptionHistorySchema = Joi.object({
    page: Joi.number().integer().min(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
    }),
    subscription_status: Joi.string().valid('all', 'active', 'expired', 'none').optional().messages({
        'string.base': 'Subscription status must be a string',
        'any.only': 'Subscription status must be one of: all, active, expired, none'
    }),
    subscription_type: Joi.string().valid('all', '1', '2').optional().messages({
        'string.base': 'Subscription type must be a string',
        'any.only': 'Subscription type must be one of: all, 1 (Yearly), 2 (Monthly)'
    }),
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'User ID must be a number',
        'number.integer': 'User ID must be an integer',
        'number.positive': 'User ID must be positive'
    }),
    search_term: Joi.string().min(1).max(100).optional().messages({
        'string.base': 'Search term must be a string',
        'string.min': 'Search term must be at least 1 character',
        'string.max': 'Search term must not exceed 100 characters'
    })
});

// Notification Validation Schemas
const createNotificationCampaignSchema = Joi.object({
    title: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Title cannot be empty',
        'string.min': 'Title must be at least 1 character',
        'string.max': 'Title cannot exceed 255 characters',
        'any.required': 'Title is required'
    }),
    message: Joi.string().min(1).max(1000).required().messages({
        'string.empty': 'Message cannot be empty',
        'string.min': 'Message must be at least 1 character',
        'string.max': 'Message cannot exceed 1000 characters',
        'any.required': 'Message is required'
    }),
    notification_type: Joi.string().valid('reminder', 'promotion', 'festival_greeting', 'message').required().messages({
        'any.only': 'Notification type must be one of: reminder, promotion, festival_greeting, message',
        'any.required': 'Notification type is required'
    }),
    target_audience: Joi.string().valid('all_users', 'free_users', 'paid_users', 'active_users', 'inactive_users', 'expired_users').required().messages({
        'any.only': 'Target audience must be one of: all_users, free_users, paid_users, active_users, inactive_users, expired_users',
        'any.required': 'Target audience is required'
    }),
    target_language: Joi.string().allow(null, '').optional().messages({
        'string.base': 'Target language must be a string'
    })
}).unknown(true); // Allow unknown fields (like campaign_id) and strip them silently

const updateNotificationCampaignSchema = Joi.object({
    campaign_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Campaign ID must be a number',
        'number.integer': 'Campaign ID must be an integer',
        'number.positive': 'Campaign ID must be positive',
        'any.required': 'Campaign ID is required'
    }),
    title: Joi.string().min(1).max(255).allow(null, '').optional().messages({
        'string.empty': 'Title cannot be empty',
        'string.min': 'Title must be at least 1 character',
        'string.max': 'Title cannot exceed 255 characters'
    }),
    message: Joi.string().min(1).max(1000).allow(null, '').optional().messages({
        'string.empty': 'Message cannot be empty',
        'string.min': 'Message must be at least 1 character',
        'string.max': 'Message cannot exceed 1000 characters'
    }),
    notification_type: Joi.string().valid('reminder', 'promotion', 'festival_greeting', 'message').allow(null, '').optional().messages({
        'any.only': 'Notification type must be one of: reminder, promotion, festival_greeting, message'
    }),
    target_audience: Joi.string().valid('all_users', 'free_users', 'paid_users', 'active_users', 'inactive_users', 'expired_users').allow(null, '').optional().messages({
        'any.only': 'Target audience must be one of: all_users, free_users, paid_users, active_users, inactive_users, expired_users'
    }),
    target_language: Joi.string().allow(null, '').optional().messages({
        'string.base': 'Target language must be a string'
    })
}).unknown(true);

const deleteNotificationCampaignSchema = Joi.object({
    campaign_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Campaign ID must be a number',
        'number.integer': 'Campaign ID must be an integer',
        'number.positive': 'Campaign ID must be positive',
        'any.required': 'Campaign ID is required'
    })
});

const sendNotificationCampaignSchema = Joi.object({
    campaign_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Campaign ID must be a number',
        'number.integer': 'Campaign ID must be an integer',
        'number.positive': 'Campaign ID must be positive',
        'any.required': 'Campaign ID is required'
    })
});

const updateUserDeviceTokenSchema = Joi.object({
    fcm_token: Joi.string().min(10).max(255).required().messages({
        'string.empty': 'FCM token cannot be empty',
        'string.min': 'FCM token must be at least 10 characters',
        'string.max': 'FCM token cannot exceed 255 characters',
        'any.required': 'FCM token is required'
    }),
    device_type: Joi.string().valid('android', 'ios', 'web').required().messages({
        'any.only': 'Device type must be one of: android, ios, web',
        'any.required': 'Device type is required'
    }),
    device_id: Joi.string().max(255).optional().messages({
        'string.max': 'Device ID cannot exceed 255 characters'
    }),
    app_version: Joi.string().max(50).optional().messages({
        'string.max': 'App version cannot exceed 50 characters'
    })
});

const getAllNotificationCampaignsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    status: Joi.string().valid('draft', 'scheduled', 'sent', 'cancelled').optional().messages({
        'any.only': 'Status must be one of: draft, scheduled, sent, cancelled'
    }),
    notification_type: Joi.string().valid('reminder', 'promotion', 'festival_greeting', 'message').optional().messages({
        'any.only': 'Notification type must be one of: reminder, promotion, festival_greeting, message'
    })
});

const getNotificationPerformanceStatsSchema = Joi.object({
    campaign_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'Campaign ID must be a number',
        'number.integer': 'Campaign ID must be an integer',
        'number.positive': 'Campaign ID must be positive'
    }),
    days: Joi.number().integer().min(1).max(365).default(30).messages({
        'number.base': 'Days must be a number',
        'number.integer': 'Days must be an integer',
        'number.min': 'Days must be at least 1',
        'number.max': 'Days cannot exceed 365'
    })
});

const updateNotificationStatusSchema = Joi.object({
    notification_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Notification ID must be a number',
        'number.integer': 'Notification ID must be an integer',
        'number.positive': 'Notification ID must be positive',
        'any.required': 'Notification ID is required'
    }),
    status: Joi.string().valid('delivered', 'opened', 'clicked', 'failed').required().messages({
        'any.only': 'Status must be one of: delivered, opened, clicked, failed',
        'any.required': 'Status is required'
    })
});

// Content Management Validation Schemas

// Banner Management Schemas
const createBannerSchema = Joi.object({
    banner_text: Joi.string().min(1).max(500).required().messages({
        'string.empty': 'Banner text cannot be empty',
        'string.min': 'Banner text must be at least 1 character',
        'string.max': 'Banner text cannot exceed 500 characters',
        'any.required': 'Banner text is required'
    }),
    banner_url: Joi.string().uri().max(1000).required().messages({
        'string.uri': 'Banner URL must be a valid URL',
        'string.max': 'Banner URL cannot exceed 1000 characters',
        'any.required': 'Banner URL is required'
    }),
    banner_link: Joi.string().uri().max(1000).allow(null, '').messages({
        'string.uri': 'Banner link must be a valid URL',
        'string.max': 'Banner link cannot exceed 1000 characters'
    }),
    banner_type: Joi.string().valid('promotion', 'announcement', 'feature', 'festival').default('announcement').messages({
        'any.only': 'Banner type must be one of: promotion, announcement, feature, festival'
    }),
    priority: Joi.number().integer().min(1).max(10).default(1).messages({
        'number.base': 'Priority must be a number',
        'number.integer': 'Priority must be an integer',
        'number.min': 'Priority must be at least 1',
        'number.max': 'Priority cannot exceed 10'
    }),
    start_date: Joi.date().iso().allow(null).messages({
        'date.format': 'Start date must be in ISO format'
    }),
    end_date: Joi.date().iso().allow(null).messages({
        'date.format': 'End date must be in ISO format'
    }),
    target_audience: Joi.string().valid('all_users', 'premium_users', 'free_users').default('all_users').messages({
        'any.only': 'Target audience must be one of: all_users, premium_users, free_users'
    })
});

const updateBannerSchema = Joi.object({
    banner_text: Joi.string().min(1).max(500).messages({
        'string.empty': 'Banner text cannot be empty',
        'string.min': 'Banner text must be at least 1 character',
        'string.max': 'Banner text cannot exceed 500 characters'
    }),
    banner_url: Joi.string().uri().max(1000).messages({
        'string.uri': 'Banner URL must be a valid URL',
        'string.max': 'Banner URL cannot exceed 1000 characters'
    }),
    banner_link: Joi.string().uri().max(1000).allow(null, '').messages({
        'string.uri': 'Banner link must be a valid URL',
        'string.max': 'Banner link cannot exceed 1000 characters'
    }),
    banner_type: Joi.string().valid('promotion', 'announcement', 'feature', 'festival').messages({
        'any.only': 'Banner type must be one of: promotion, announcement, feature, festival'
    }),
    priority: Joi.number().integer().min(1).max(10).messages({
        'number.base': 'Priority must be a number',
        'number.integer': 'Priority must be an integer',
        'number.min': 'Priority must be at least 1',
        'number.max': 'Priority cannot exceed 10'
    }),
    start_date: Joi.date().iso().allow(null).messages({
        'date.format': 'Start date must be in ISO format'
    }),
    end_date: Joi.date().iso().allow(null).messages({
        'date.format': 'End date must be in ISO format'
    }),
    target_audience: Joi.string().valid('all_users', 'premium_users', 'free_users').messages({
        'any.only': 'Target audience must be one of: all_users, premium_users, free_users'
    }),
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    })
});

const getAllBannersSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    banner_type: Joi.string().valid('promotion', 'announcement', 'feature', 'festival').messages({
        'any.only': 'Banner type must be one of: promotion, announcement, feature, festival'
    }),
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    }),
    target_audience: Joi.string().valid('all_users', 'premium_users', 'free_users').messages({
        'any.only': 'Target audience must be one of: all_users, premium_users, free_users'
    }),
    search: Joi.string().max(100).messages({
        'string.max': 'Search term cannot exceed 100 characters'
    })
});

// Tutorial Management Schemas
const createTutorialSchema = Joi.object({
    tutorial_title: Joi.string().min(1).max(200).required().messages({
        'string.empty': 'Tutorial title cannot be empty',
        'string.min': 'Tutorial title must be at least 1 character',
        'string.max': 'Tutorial title cannot exceed 200 characters',
        'any.required': 'Tutorial title is required'
    }),
    tutorial_description: Joi.string().max(1000).allow(null, '').messages({
        'string.max': 'Tutorial description cannot exceed 1000 characters'
    }),
    video_url: Joi.string().uri().max(1000).required().messages({
        'string.uri': 'Video URL must be a valid URL',
        'string.max': 'Video URL cannot exceed 1000 characters',
        'any.required': 'Video URL is required'
    }),
    thumbnail_url: Joi.string().uri().max(1000).allow(null, '').messages({
        'string.uri': 'Thumbnail URL must be a valid URL',
        'string.max': 'Thumbnail URL cannot exceed 1000 characters'
    }),
    language: Joi.string().valid('hindi', 'marathi', 'english').default('hindi').messages({
        'any.only': 'Language must be one of: hindi, marathi, english'
    }),
    category: Joi.string().valid('getting_started', 'advanced_features', 'tips_tricks', 'troubleshooting').default('getting_started').messages({
        'any.only': 'Category must be one of: getting_started, advanced_features, tips_tricks, troubleshooting'
    }),
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').default('beginner').messages({
        'any.only': 'Difficulty level must be one of: beginner, intermediate, advanced'
    }),
    duration_minutes: Joi.number().integer().min(1).max(300).allow(null).messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be an integer',
        'number.min': 'Duration must be at least 1 minute',
        'number.max': 'Duration cannot exceed 300 minutes'
    }),
    is_featured: Joi.boolean().default(false).messages({
        'boolean.base': 'is_featured must be a boolean'
    }),
    sort_order: Joi.number().integer().min(0).default(0).messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order cannot be negative'
    })
});

const updateTutorialSchema = Joi.object({
    tutorial_title: Joi.string().min(1).max(200).messages({
        'string.empty': 'Tutorial title cannot be empty',
        'string.min': 'Tutorial title must be at least 1 character',
        'string.max': 'Tutorial title cannot exceed 200 characters'
    }),
    tutorial_description: Joi.string().max(1000).allow(null, '').messages({
        'string.max': 'Tutorial description cannot exceed 1000 characters'
    }),
    video_url: Joi.string().uri().max(1000).messages({
        'string.uri': 'Video URL must be a valid URL',
        'string.max': 'Video URL cannot exceed 1000 characters'
    }),
    thumbnail_url: Joi.string().uri().max(1000).allow(null, '').messages({
        'string.uri': 'Thumbnail URL must be a valid URL',
        'string.max': 'Thumbnail URL cannot exceed 1000 characters'
    }),
    language: Joi.string().valid('hindi', 'marathi', 'english').messages({
        'any.only': 'Language must be one of: hindi, marathi, english'
    }),
    category: Joi.string().valid('getting_started', 'advanced_features', 'tips_tricks', 'troubleshooting').messages({
        'any.only': 'Category must be one of: getting_started, advanced_features, tips_tricks, troubleshooting'
    }),
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').messages({
        'any.only': 'Difficulty level must be one of: beginner, intermediate, advanced'
    }),
    duration_minutes: Joi.number().integer().min(1).max(300).allow(null).messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be an integer',
        'number.min': 'Duration must be at least 1 minute',
        'number.max': 'Duration cannot exceed 300 minutes'
    }),
    is_featured: Joi.boolean().messages({
        'boolean.base': 'is_featured must be a boolean'
    }),
    sort_order: Joi.number().integer().min(0).messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order cannot be negative'
    }),
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    })
});

const getAllTutorialsSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    language: Joi.string().valid('hindi', 'marathi', 'english').messages({
        'any.only': 'Language must be one of: hindi, marathi, english'
    }),
    category: Joi.string().valid('getting_started', 'advanced_features', 'tips_tricks', 'troubleshooting').messages({
        'any.only': 'Category must be one of: getting_started, advanced_features, tips_tricks, troubleshooting'
    }),
    difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').messages({
        'any.only': 'Difficulty level must be one of: beginner, intermediate, advanced'
    }),
    is_featured: Joi.boolean().messages({
        'boolean.base': 'is_featured must be a boolean'
    }),
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    }),
    search: Joi.string().max(100).messages({
        'string.max': 'Search term cannot exceed 100 characters'
    })
});

const trackTutorialViewSchema = Joi.object({
    device_type: Joi.string().valid('mobile', 'desktop', 'tablet').default('mobile').messages({
        'any.only': 'Device type must be one of: mobile, desktop, tablet'
    })
});

// Terms & Conditions Management Validation Schemas

// Policy Point Management Schemas
const createPolicyPointSchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Category ID must be a number',
        'number.integer': 'Category ID must be an integer',
        'number.positive': 'Category ID must be positive',
        'any.required': 'Category ID is required'
    }),
    point_title: Joi.string().min(1).max(500).required().messages({
        'string.empty': 'Point title cannot be empty',
        'string.min': 'Point title must be at least 1 character',
        'string.max': 'Point title cannot exceed 500 characters',
        'any.required': 'Point title is required'
    }),
    point_description: Joi.string().min(1).max(5000).required().messages({
        'string.empty': 'Point description cannot be empty',
        'string.min': 'Point description must be at least 1 character',
        'string.max': 'Point description cannot exceed 5000 characters',
        'any.required': 'Point description is required'
    }),
    point_order: Joi.number().integer().min(0).default(0).messages({
        'number.base': 'Point order must be a number',
        'number.integer': 'Point order must be an integer',
        'number.min': 'Point order cannot be negative'
    })
});

const updatePolicyPointSchema = Joi.object({
    point_title: Joi.string().min(1).max(500).messages({
        'string.empty': 'Point title cannot be empty',
        'string.min': 'Point title must be at least 1 character',
        'string.max': 'Point title cannot exceed 500 characters'
    }),
    point_description: Joi.string().min(1).max(5000).messages({
        'string.empty': 'Point description cannot be empty',
        'string.min': 'Point description must be at least 1 character',
        'string.max': 'Point description cannot exceed 5000 characters'
    }),
    point_order: Joi.number().integer().min(0).messages({
        'number.base': 'Point order must be a number',
        'number.integer': 'Point order must be an integer',
        'number.min': 'Point order cannot be negative'
    }),
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    })
});

const reorderPolicyPointsSchema = Joi.object({
    points: Joi.array().items(
        Joi.object({
            point_id: Joi.number().integer().positive().required().messages({
                'number.base': 'Point ID must be a number',
                'number.integer': 'Point ID must be an integer',
                'number.positive': 'Point ID must be positive',
                'any.required': 'Point ID is required'
            }),
            point_order: Joi.number().integer().min(0).required().messages({
                'number.base': 'Point order must be a number',
                'number.integer': 'Point order must be an integer',
                'number.min': 'Point order cannot be negative',
                'any.required': 'Point order is required'
            })
        })
    ).min(1).required().messages({
        'array.min': 'At least one point is required',
        'any.required': 'Points array is required'
    })
});

const createPolicyVersionSchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Category ID must be a number',
        'number.integer': 'Category ID must be an integer',
        'number.positive': 'Category ID must be positive',
        'any.required': 'Category ID is required'
    }),
    version_number: Joi.string().min(1).max(20).required().messages({
        'string.empty': 'Version number cannot be empty',
        'string.min': 'Version number must be at least 1 character',
        'string.max': 'Version number cannot exceed 20 characters',
        'any.required': 'Version number is required'
    }),
    version_description: Joi.string().max(1000).allow(null, '').messages({
        'string.max': 'Version description cannot exceed 1000 characters'
    }),
    effective_date: Joi.date().iso().required().messages({
        'date.format': 'Effective date must be in ISO format',
        'any.required': 'Effective date is required'
    }),
    policy_data: Joi.object().required().messages({
        'object.base': 'Policy data must be an object',
        'any.required': 'Policy data is required'
    })
});

const acceptPolicyVersionSchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Category ID must be a number',
        'number.integer': 'Category ID must be an integer',
        'number.positive': 'Category ID must be positive',
        'any.required': 'Category ID is required'
    })
});

const getPolicyPointsSchema = Joi.object({
    is_active: Joi.boolean().messages({
        'boolean.base': 'is_active must be a boolean'
    })
});

// Refer & Earn System Validation Schemas

// Free Trial Management Schemas
const checkFreeTrialEligibilitySchema = Joi.object({
    device_id: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Device ID cannot be empty',
        'string.min': 'Device ID must be at least 1 character',
        'string.max': 'Device ID cannot exceed 255 characters',
        'any.required': 'Device ID is required'
    })
});

const activateFreeTrialSchema = Joi.object({
    device_id: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Device ID cannot be empty',
        'string.min': 'Device ID must be at least 1 character',
        'string.max': 'Device ID cannot exceed 255 characters',
        'any.required': 'Device ID is required'
    })
});

// Referral Code Management Schemas
const applyReferralCodeSchema = Joi.object({
    referral_code: Joi.string().min(1).max(20).required().messages({
        'string.empty': 'Referral code cannot be empty',
        'string.min': 'Referral code must be at least 1 character',
        'string.max': 'Referral code cannot exceed 20 characters',
        'any.required': 'Referral code is required'
    }),
    device_id: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Device ID cannot be empty',
        'string.min': 'Device ID must be at least 1 character',
        'string.max': 'Device ID cannot exceed 255 characters',
        'any.required': 'Device ID is required'
    })
});

// Admin Analytics Schemas
const getReferralAnalyticsSchema = Joi.object({
    start_date: Joi.date().iso().messages({
        'date.format': 'Start date must be in ISO format (YYYY-MM-DD)'
    }),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).messages({
        'date.format': 'End date must be in ISO format (YYYY-MM-DD)',
        'date.min': 'End date must be after start date'
    }),
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(50).messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    })
});

// Subscription Plan Management Schemas
const createSubscriptionPlanSchema = Joi.object({
    description: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Description cannot be empty',
        'string.min': 'Description must be at least 1 character',
        'string.max': 'Description cannot exceed 255 characters',
        'any.required': 'Description is required'
    }),
    text: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Text cannot be empty',
        'string.min': 'Text must be at least 1 character',
        'string.max': 'Text cannot exceed 255 characters',
        'any.required': 'Text is required'
    }),
    amount: Joi.number().min(0).required().messages({
        'number.base': 'Amount must be a number',
        'number.min': 'Amount must be a non-negative number',
        'any.required': 'Amount is required'
    }),
    subscription_type: Joi.number().integer().valid(1, 2, 3, 4).required().messages({
        'number.base': 'Subscription type must be a number',
        'number.integer': 'Subscription type must be an integer',
        'any.only': 'Subscription type must be 1 (Yearly), 2 (Monthly), 3 (Lifetime), or 4 (Other)',
        'any.required': 'Subscription type is required'
    }),
    validity_days: Joi.number().integer().min(1).max(36500).messages({
        'number.base': 'Validity days must be a number',
        'number.integer': 'Validity days must be an integer',
        'number.min': 'Validity days must be at least 1',
        'number.max': 'Validity days cannot exceed 36500 (100 years)'
    })
});

const updateSubscriptionPlanSchema = Joi.object({
    subscription_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Subscription ID must be a number',
        'number.integer': 'Subscription ID must be an integer',
        'number.positive': 'Subscription ID must be positive',
        'any.required': 'Subscription ID is required'
    }),
    description: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Description cannot be empty',
        'string.min': 'Description must be at least 1 character',
        'string.max': 'Description cannot exceed 255 characters',
        'any.required': 'Description is required'
    }),
    text: Joi.string().min(1).max(255).required().messages({
        'string.empty': 'Text cannot be empty',
        'string.min': 'Text must be at least 1 character',
        'string.max': 'Text cannot exceed 255 characters',
        'any.required': 'Text is required'
    }),
    amount: Joi.number().min(0).required().messages({
        'number.base': 'Amount must be a number',
        'number.min': 'Amount must be a non-negative number',
        'any.required': 'Amount is required'
    }),
    subscription_type: Joi.number().integer().valid(1, 2, 3, 4).required().messages({
        'number.base': 'Subscription type must be a number',
        'number.integer': 'Subscription type must be an integer',
        'any.only': 'Subscription type must be 1 (Yearly), 2 (Monthly), 3 (Lifetime), or 4 (Other)',
        'any.required': 'Subscription type is required'
    }),
    validity_days: Joi.number().integer().min(1).max(36500).messages({
        'number.base': 'Validity days must be a number',
        'number.integer': 'Validity days must be an integer',
        'number.min': 'Validity days must be at least 1',
        'number.max': 'Validity days cannot exceed 36500 (100 years)'
    })
});

// Feedback Management Schemas
const createFeedbackSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    feedback_type: Joi.string().valid('bug_report', 'feature_request', 'general_feedback', 'complaint', 'suggestion').required().messages({
        'string.base': 'feedback_type must be a string',
        'any.only': 'feedback_type must be one of: bug_report, feature_request, general_feedback, complaint, suggestion',
        'any.required': 'feedback_type is required'
    }),
    subject: Joi.string().min(5).max(200).required().messages({
        'string.base': 'subject must be a string',
        'string.min': 'subject must be at least 5 characters',
        'string.max': 'subject must be at most 200 characters',
        'any.required': 'subject is required'
    }),
    message: Joi.string().min(10).max(2000).required().messages({
        'string.base': 'message must be a string',
        'string.min': 'message must be at least 10 characters',
        'string.max': 'message must be at most 2000 characters',
        'any.required': 'message is required'
    }),
    device_info: Joi.string().max(500).optional().messages({
        'string.base': 'device_info must be a string',
        'string.max': 'device_info must be at most 500 characters'
    })
});

// App Rating and Feedback Schema
const createAppRatingSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
        'number.base': 'rating must be a number',
        'number.integer': 'rating must be an integer',
        'number.min': 'rating must be at least 1',
        'number.max': 'rating must be at most 5',
        'any.required': 'rating is required'
    }),
    feedback_message: Joi.string().min(5).max(2000).optional().allow('').messages({
        'string.base': 'feedback_message must be a string',
        'string.min': 'feedback_message must be at least 5 characters',
        'string.max': 'feedback_message must be at most 2000 characters'
    }),
    device_info: Joi.any().optional()
});

const updateFeedbackResponseSchema = Joi.object({
    feedback_id: Joi.number().integer().positive().required().messages({
        'number.base': 'feedback_id must be a number',
        'number.integer': 'feedback_id must be an integer',
        'number.positive': 'feedback_id must be positive',
        'any.required': 'feedback_id is required'
    }),
    admin_response: Joi.string().max(1000).required().messages({
        'string.base': 'admin_response must be a string',
        'string.max': 'admin_response must be at most 1000 characters',
        'any.required': 'admin_response is required'
    })
});

const getFeedbackSchema = Joi.object({
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive'
    }),
    feedback_type: Joi.string().valid('bug_report', 'feature_request', 'general_feedback', 'complaint', 'suggestion').optional().messages({
        'string.base': 'feedback_type must be a string',
        'any.only': 'feedback_type must be one of: bug_report, feature_request, general_feedback, complaint, suggestion'
    }),
    page: Joi.number().integer().min(1).optional().default(1).messages({
        'number.base': 'page must be a number',
        'number.integer': 'page must be an integer',
        'number.min': 'page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
        'number.base': 'limit must be a number',
        'number.integer': 'limit must be an integer',
        'number.min': 'limit must be at least 1',
        'number.max': 'limit must be at most 100'
    })
});

const deleteFeedbackSchema = Joi.object({
    feedback_id: Joi.number().integer().positive().required().messages({
        'number.base': 'feedback_id must be a number',
        'number.integer': 'feedback_id must be an integer',
        'number.positive': 'feedback_id must be positive',
        'any.required': 'feedback_id is required'
    })
});

// Manager System Validation Schemas (removed duplicate definitions)

// Contact Us Management Validation Schemas
const createContactConfigSchema = Joi.object({
    config_type: Joi.string().valid('whatsapp', 'phone', 'email', 'website', 'support_hours', 'app_download').required().messages({
        'string.base': 'Config type must be a string',
        'any.only': 'Config type must be one of: whatsapp, phone, email, website, support_hours, app_download',
        'any.required': 'Config type is required'
    }),
    config_key: Joi.string().min(1).max(100).required().messages({
        'string.min': 'Config key must be at least 1 character',
        'string.max': 'Config key must be at most 100 characters',
        'any.required': 'Config key is required'
    }),
    config_value: Joi.string().min(1).max(1000).required().messages({
        'string.min': 'Config value must be at least 1 character',
        'string.max': 'Config value must be at most 1000 characters',
        'any.required': 'Config value is required'
    }),
    display_text: Joi.string().max(255).optional().allow('').messages({
        'string.max': 'Display text must be at most 255 characters'
    }),
    icon_name: Joi.string().max(100).optional().allow('').messages({
        'string.max': 'Icon name must be at most 100 characters'
    }),
    sort_order: Joi.number().integer().min(0).optional().default(0).messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order must be at least 0'
    }),
    is_active: Joi.boolean().optional().default(true).messages({
        'boolean.base': 'Is active must be a boolean value'
    })
});

const updateContactConfigSchema = Joi.object({
    config_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Config ID must be a number',
        'number.integer': 'Config ID must be an integer',
        'number.positive': 'Config ID must be positive',
        'any.required': 'Config ID is required'
    }),
    config_type: Joi.string().valid('whatsapp', 'phone', 'email', 'website', 'support_hours', 'app_download').optional().messages({
        'string.base': 'Config type must be a string',
        'any.only': 'Config type must be one of: whatsapp, phone, email, website, support_hours, app_download'
    }),
    config_key: Joi.string().min(1).max(100).optional().messages({
        'string.min': 'Config key must be at least 1 character',
        'string.max': 'Config key must be at most 100 characters'
    }),
    config_value: Joi.string().min(1).max(1000).optional().messages({
        'string.min': 'Config value must be at least 1 character',
        'string.max': 'Config value must be at most 1000 characters'
    }),
    display_text: Joi.string().max(255).optional().allow('').messages({
        'string.max': 'Display text must be at most 255 characters'
    }),
    icon_name: Joi.string().max(100).optional().allow('').messages({
        'string.max': 'Icon name must be at most 100 characters'
    }),
    sort_order: Joi.number().integer().min(0).optional().messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order must be at least 0'
    }),
    is_active: Joi.boolean().optional().messages({
        'boolean.base': 'Is active must be a boolean value'
    })
});

const deleteContactConfigSchema = Joi.object({
    config_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Config ID must be a number',
        'number.integer': 'Config ID must be an integer',
        'number.positive': 'Config ID must be positive',
        'any.required': 'Config ID is required'
    })
});

const createAppDownloadLinkSchema = Joi.object({
    platform: Joi.string().valid('android', 'ios', 'web').required().messages({
        'string.base': 'Platform must be a string',
        'any.only': 'Platform must be one of: android, ios, web',
        'any.required': 'Platform is required'
    }),
    platform_name: Joi.string().min(1).max(50).required().messages({
        'string.min': 'Platform name must be at least 1 character',
        'string.max': 'Platform name must be at most 50 characters',
        'any.required': 'Platform name is required'
    }),
    download_url: Joi.string().uri().max(500).required().messages({
        'string.uri': 'Download URL must be a valid URL',
        'string.max': 'Download URL must be at most 500 characters',
        'any.required': 'Download URL is required'
    }),
    icon_name: Joi.string().max(100).optional().allow('').messages({
        'string.max': 'Icon name must be at most 100 characters'
    }),
    sort_order: Joi.number().integer().min(0).optional().default(0).messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order must be at least 0'
    })
});

const updateAppDownloadLinkSchema = Joi.object({
    link_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Link ID must be a number',
        'number.integer': 'Link ID must be an integer',
        'number.positive': 'Link ID must be positive',
        'any.required': 'Link ID is required'
    }),
    platform_name: Joi.string().min(1).max(50).optional().messages({
        'string.min': 'Platform name must be at least 1 character',
        'string.max': 'Platform name must be at most 50 characters'
    }),
    download_url: Joi.string().uri().max(500).optional().messages({
        'string.uri': 'Download URL must be a valid URL',
        'string.max': 'Download URL must be at most 500 characters'
    }),
    icon_name: Joi.string().max(100).optional().allow('').messages({
        'string.max': 'Icon name must be at most 100 characters'
    }),
    sort_order: Joi.number().integer().min(0).optional().messages({
        'number.base': 'Sort order must be a number',
        'number.integer': 'Sort order must be an integer',
        'number.min': 'Sort order must be at least 0'
    }),
    is_active: Joi.boolean().optional().messages({
        'boolean.base': 'Is active must be a boolean value'
    })
});

const deleteAppDownloadLinkSchema = Joi.object({
    link_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Link ID must be a number',
        'number.integer': 'Link ID must be an integer',
        'number.positive': 'Link ID must be positive',
        'any.required': 'Link ID is required'
    })
});

// User Management Schemas
const getUserInfoSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    })
});

// Schema for endpoints requiring user_id and account_id
const getUserAccountSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    })
});

// Schema for endpoints requiring user_id, account_id, and optional month_year
const getUserAccountMonthSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'account_id must be a number',
        'number.integer': 'account_id must be an integer',
        'number.positive': 'account_id must be positive',
        'any.required': 'account_id is required'
    }),
    month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional().messages({
        'string.pattern.base': 'month_year must be in format YYYY-MM'
    }),
    year: Joi.number().integer().min(2000).max(2100).optional().messages({
        'number.base': 'year must be a number',
        'number.integer': 'year must be an integer',
        'number.min': 'year must be at least 2000',
        'number.max': 'year must be at most 2100'
    }),
    month: Joi.number().integer().min(1).max(12).optional().messages({
        'number.base': 'month must be a number',
        'number.integer': 'month must be an integer',
        'number.min': 'month must be between 1 and 12',
        'number.max': 'month must be between 1 and 12'
    })
});

const manageUserStatusSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    }),
    action: Joi.string().valid('suspend', 'activate').required().messages({
        'string.base': 'action must be a string',
        'any.only': 'action must be either "suspend" or "activate"',
        'any.required': 'action is required'
    }),
    reason: Joi.string().max(500).optional().allow('').messages({
        'string.base': 'reason must be a string',
        'string.max': 'reason must be at most 500 characters'
    })
});

// ===== FAQ Management Schemas =====

// Get FAQs by Category Schema
const getFaqsByCategorySchema = Joi.object({
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive'
    })
});

// Get FAQ by ID Schema
const getFaqByIdSchema = Joi.object({
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive'
    })
});

// Search FAQs Schema
const searchFaqsSchema = Joi.object({
    search_query: Joi.string().min(2).max(100).required().messages({
        'string.base': 'search_query must be a string',
        'string.min': 'search_query must be at least 2 characters',
        'string.max': 'search_query must be at most 100 characters',
        'any.required': 'search_query is required'
    }),
    category_name: Joi.string().max(50).optional().messages({
        'string.base': 'category_name must be a string',
        'string.max': 'category_name must be at most 50 characters'
    }),
    user_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive'
    })
});

// Create FAQ Category Schema
const createFaqCategorySchema = Joi.object({
    category_name: Joi.string().min(2).max(50).required().messages({
        'string.base': 'category_name must be a string',
        'string.min': 'category_name must be at least 2 characters',
        'string.max': 'category_name must be at most 50 characters',
        'any.required': 'category_name is required'
    }),
    category_title: Joi.string().min(2).max(100).required().messages({
        'string.base': 'category_title must be a string',
        'string.min': 'category_title must be at least 2 characters',
        'string.max': 'category_title must be at most 100 characters',
        'any.required': 'category_title is required'
    }),
    category_description: Joi.string().max(500).optional().allow('').messages({
        'string.base': 'category_description must be a string',
        'string.max': 'category_description must be at most 500 characters'
    }),
    category_icon: Joi.string().max(50).optional().messages({
        'string.base': 'category_icon must be a string',
        'string.max': 'category_icon must be at most 50 characters'
    }),
    sort_order: Joi.number().integer().min(0).optional().messages({
        'number.base': 'sort_order must be a number',
        'number.integer': 'sort_order must be an integer',
        'number.min': 'sort_order must be at least 0'
    })
});

// Create FAQ Item Schema
const createFaqItemSchema = Joi.object({
    category_id: Joi.number().integer().positive().required().messages({
        'number.base': 'category_id must be a number',
        'number.integer': 'category_id must be an integer',
        'number.positive': 'category_id must be positive',
        'any.required': 'category_id is required'
    }),
    question: Joi.string().min(5).max(500).required().messages({
        'string.base': 'question must be a string',
        'string.min': 'question must be at least 5 characters',
        'string.max': 'question must be at most 500 characters',
        'any.required': 'question is required'
    }),
    answer: Joi.string().min(10).max(2000).required().messages({
        'string.base': 'answer must be a string',
        'string.min': 'answer must be at least 10 characters',
        'string.max': 'answer must be at most 2000 characters',
        'any.required': 'answer is required'
    }),
    youtube_tutorial_url: Joi.string().uri().max(500).optional().allow('').messages({
        'string.base': 'youtube_tutorial_url must be a string',
        'string.uri': 'youtube_tutorial_url must be a valid URL',
        'string.max': 'youtube_tutorial_url must be at most 500 characters'
    }),
    youtube_thumbnail_url: Joi.string().uri().max(500).optional().allow('').messages({
        'string.base': 'youtube_thumbnail_url must be a string',
        'string.uri': 'youtube_thumbnail_url must be a valid URL',
        'string.max': 'youtube_thumbnail_url must be at most 500 characters'
    }),
    youtube_video_id: Joi.string().max(100).optional().allow('').messages({
        'string.base': 'youtube_video_id must be a string',
        'string.max': 'youtube_video_id must be at most 100 characters'
    }),
    is_featured: Joi.boolean().optional().messages({
        'boolean.base': 'is_featured must be a boolean'
    }),
    sort_order: Joi.number().integer().min(0).optional().messages({
        'number.base': 'sort_order must be a number',
        'number.integer': 'sort_order must be an integer',
        'number.min': 'sort_order must be at least 0'
    })
});

// Update FAQ Item Schema
const updateFaqItemSchema = Joi.object({
    category_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'category_id must be a number',
        'number.integer': 'category_id must be an integer',
        'number.positive': 'category_id must be positive'
    }),
    question: Joi.string().min(5).max(500).optional().messages({
        'string.base': 'question must be a string',
        'string.min': 'question must be at least 5 characters',
        'string.max': 'question must be at most 500 characters'
    }),
    answer: Joi.string().min(10).max(2000).optional().messages({
        'string.base': 'answer must be a string',
        'string.min': 'answer must be at least 10 characters',
        'string.max': 'answer must be at most 2000 characters'
    }),
    youtube_tutorial_url: Joi.string().uri().max(500).optional().allow('').messages({
        'string.base': 'youtube_tutorial_url must be a string',
        'string.uri': 'youtube_tutorial_url must be a valid URL',
        'string.max': 'youtube_tutorial_url must be at most 500 characters'
    }),
    youtube_thumbnail_url: Joi.string().uri().max(500).optional().allow('').messages({
        'string.base': 'youtube_thumbnail_url must be a string',
        'string.uri': 'youtube_thumbnail_url must be a valid URL',
        'string.max': 'youtube_thumbnail_url must be at most 500 characters'
    }),
    youtube_video_id: Joi.string().max(100).optional().allow('').messages({
        'string.base': 'youtube_video_id must be a string',
        'string.max': 'youtube_video_id must be at most 100 characters'
    }),
    is_featured: Joi.boolean().optional().messages({
        'boolean.base': 'is_featured must be a boolean'
    }),
    is_active: Joi.boolean().optional().messages({
        'boolean.base': 'is_active must be a boolean'
    }),
    sort_order: Joi.number().integer().min(0).optional().messages({
        'number.base': 'sort_order must be a number',
        'number.integer': 'sort_order must be an integer',
        'number.min': 'sort_order must be at least 0'
    })
});

// Delete FAQ Item Schema
const deleteFaqItemSchema = Joi.object({
    // No body parameters needed for delete operation
});

// Get FAQ Analytics Schema
const getFaqAnalyticsSchema = Joi.object({
    start_date: Joi.date().iso().optional().messages({
        'date.base': 'start_date must be a valid date',
        'date.format': 'start_date must be in ISO format'
    }),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional().messages({
        'date.base': 'end_date must be a valid date',
        'date.format': 'end_date must be in ISO format',
        'date.min': 'end_date must be after start_date'
    })
});

const removeAppLockSchema = Joi.object({
    user_id: Joi.number().integer().positive().required().messages({
        'number.base': 'user_id must be a number',
        'number.integer': 'user_id must be an integer',
        'number.positive': 'user_id must be positive',
        'any.required': 'user_id is required'
    })
});

export {
    loginWithMobileSchema,
    signUpWithMobileSchema,
    resendOtpSchema,
    getAllCategorySchema,
    otpVerifySchema,
    contactUsSchema,
    publicContactUsSchema,
    deleteAccountSchema,
    createProfileSchema,
    validateAppLock,
    removeAppLockSchema,
    addCategorySchema,
    categoryDeleteSchema,
    categoryEditSchema,
    editTeamMemberSchema,
    addTeamMemberSchema,
    faqSchema,
    customerEditSchema,
    customerDeleteSchema,
    addOpeningStockSchema,
    addPurchaseStockSchema,
    adminRegisterSchema,
    adminLoginSchema,
    adminCreateCategorySchema,
    addManagerSchema,
    updateManagerSchema,
    removeManagerSchema,
    adminUpdateCategorySchema,
    adminDeleteCategorySchema,
    weeklyGraphDataSchema,
    monthlyGraphDataSchema,
    adminPaymentHistorySchema,
    adminUserSubscriptionHistorySchema,
    createNotificationCampaignSchema,
    updateNotificationCampaignSchema,
    deleteNotificationCampaignSchema,
    sendNotificationCampaignSchema,
    updateUserDeviceTokenSchema,
    getAllNotificationCampaignsSchema,
    getNotificationPerformanceStatsSchema,
    updateNotificationStatusSchema,
    // Content Management Schemas
    createBannerSchema,
    updateBannerSchema,
    getAllBannersSchema,
    createTutorialSchema,
    updateTutorialSchema,
    getAllTutorialsSchema,
    trackTutorialViewSchema,
    // Terms & Conditions Management Schemas
    createPolicyPointSchema,
    updatePolicyPointSchema,
    reorderPolicyPointsSchema,
    createPolicyVersionSchema,
    acceptPolicyVersionSchema,
    getPolicyPointsSchema,
    // Refer & Earn System Schemas
    checkFreeTrialEligibilitySchema,
    activateFreeTrialSchema,
    applyReferralCodeSchema,
    getReferralAnalyticsSchema,
    // Subscription Plan Management Schemas
    createSubscriptionPlanSchema,
    updateSubscriptionPlanSchema,
    // Feedback Management Schemas
    createFeedbackSchema,
    createAppRatingSchema,
    updateFeedbackResponseSchema,
    getFeedbackSchema,
    deleteFeedbackSchema,
    // Contact Us Management Schemas
    createContactConfigSchema,
    updateContactConfigSchema,
    deleteContactConfigSchema,
    createAppDownloadLinkSchema,
    updateAppDownloadLinkSchema,
    deleteAppDownloadLinkSchema,
    // User Management Schemas
    getUserInfoSchema,
    getUserAccountSchema,
    getUserAccountMonthSchema,
    manageUserStatusSchema,
    // FAQ Management Schemas
    getFaqsByCategorySchema,
    getFaqByIdSchema,
    searchFaqsSchema,
    createFaqCategorySchema,
    createFaqItemSchema,
    updateFaqItemSchema,
    deleteFaqItemSchema,
    getFaqAnalyticsSchema,
    managerLoginOTPSchema,
    managerVerifyOTPSchema,
    managerResendOTPSchema,
    getManagerActivityLogSchema
};

// Manager OTP Validation Schemas
const managerLoginOTPSchema = Joi.object({
    mobile: Joi.string()
        .required()
        .messages({
            'string.empty': 'Mobile number is required',
            'any.required': 'Mobile number is required'
        }),
    phone_code: Joi.string()
        .required()
        .messages({
            'string.empty': 'Phone code is required',
            'any.required': 'Phone code is required'
        })
});

const managerVerifyOTPSchema = Joi.object({
    mobile: Joi.string()
        .required()
        .messages({
            'string.empty': 'Mobile number is required',
            'any.required': 'Mobile number is required'
        }),
    phone_code: Joi.string()
        .required()
        .messages({
            'string.empty': 'Phone code is required',
            'any.required': 'Phone code is required'
        }),
    otp: Joi.string()
        .required()
        .messages({
            'string.empty': 'OTP is required',
            'any.required': 'OTP is required'
        })
});

const managerResendOTPSchema = Joi.object({
    mobile: Joi.string()
        .required()
        .messages({
            'string.empty': 'Mobile number is required',
            'any.required': 'Mobile number is required'
        }),
    phone_code: Joi.string()
        .required()
        .messages({
            'string.empty': 'Phone code is required',
            'any.required': 'Phone code is required'
        })
});

// Manager Management Validation Schemas
const addManagerSchema = Joi.object({
    manager_mobile: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
        'string.pattern.base': 'Mobile number must be 10 digits',
        'any.required': 'Manager mobile number is required'
    }),
    manager_name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Manager name must be at least 2 characters',
        'string.max': 'Manager name must not exceed 100 characters',
        'any.required': 'Manager name is required'
    }),
    manager_email: Joi.string().email().optional().messages({
        'string.email': 'Please provide a valid email address'
    }),
    business_account_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Business account ID must be a number',
        'number.integer': 'Business account ID must be an integer',
        'number.positive': 'Business account ID must be positive',
        'any.required': 'Business account ID is required'
    }),
    manager_role: Joi.string().valid('full_access', 'limited_access', 'view_only').default('full_access').messages({
        'any.only': 'Manager role must be one of: full_access, limited_access, view_only'
    }),
    permissions: Joi.object({
        transactions: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        customers: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        stock: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        reports: Joi.object({
            view: Joi.boolean(),
            export: Joi.boolean()
        }).optional(),
        settings: Joi.object({
            view: Joi.boolean(),
            edit: Joi.boolean()
        }).optional(),
        team_members: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        budget: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional()
    }).optional(),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes must not exceed 500 characters'
    })
});

const updateManagerSchema = Joi.object({
    manager_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Manager ID must be a number',
        'number.integer': 'Manager ID must be an integer',
        'number.positive': 'Manager ID must be positive',
        'any.required': 'Manager ID is required'
    }),
    manager_role: Joi.string().valid('full_access', 'limited_access', 'view_only').optional().messages({
        'any.only': 'Manager role must be one of: full_access, limited_access, view_only'
    }),
    permissions: Joi.object({
        transactions: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        customers: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        stock: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        reports: Joi.object({
            view: Joi.boolean(),
            export: Joi.boolean()
        }).optional(),
        settings: Joi.object({
            view: Joi.boolean(),
            edit: Joi.boolean()
        }).optional(),
        team_members: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional(),
        budget: Joi.object({
            view: Joi.boolean(),
            add: Joi.boolean(),
            edit: Joi.boolean(),
            delete: Joi.boolean()
        }).optional()
    }).optional(),
    business_account_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'Business account ID must be a number',
        'number.integer': 'Business account ID must be an integer',
        'number.positive': 'Business account ID must be positive'
    }),
    status: Joi.string().valid('active', 'inactive', 'pending').optional().messages({
        'any.only': 'Status must be one of: active, inactive, pending'
    }),
    notes: Joi.string().max(500).optional().messages({
        'string.max': 'Notes must not exceed 500 characters'
    })
});

const removeManagerSchema = Joi.object({
    manager_id: Joi.number().integer().positive().required().messages({
        'number.base': 'Manager ID must be a number',
        'number.integer': 'Manager ID must be an integer',
        'number.positive': 'Manager ID must be positive',
        'any.required': 'Manager ID is required'
    })
});

const getManagerActivityLogSchema = Joi.object({
    manager_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'Manager ID must be a number',
        'number.integer': 'Manager ID must be an integer',
        'number.positive': 'Manager ID must be positive'
    }),
    business_account_id: Joi.number().integer().positive().optional().messages({
        'number.base': 'Business account ID must be a number',
        'number.integer': 'Business account ID must be an integer',
        'number.positive': 'Business account ID must be positive'
    }),
    limit: Joi.number().integer().min(1).max(100).default(50).optional().messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 100'
    }),
    offset: Joi.number().integer().min(0).default(0).optional().messages({
        'number.base': 'Offset must be a number',
        'number.integer': 'Offset must be an integer',
        'number.min': 'Offset must be at least 0'
    })
});