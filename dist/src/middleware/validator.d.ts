import { Request, Response, NextFunction } from 'express';
import { ValidationChain } from 'express-validator';
/**
 * Validation result handler
 * Checks for validation errors and returns appropriate response
 */
export declare function handleValidationErrors(req: Request, res: Response, next: NextFunction): void;
/**
 * Create validation middleware chain with error handling
 */
export declare function validate(validations: ValidationChain[]): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const userValidation: {
    register: ValidationChain[];
    login: ValidationChain[];
    update: ValidationChain[];
    changePassword: ValidationChain[];
};
export declare const accountValidation: {
    create: ValidationChain[];
    update: ValidationChain[];
    getById: ValidationChain[];
};
export declare const analyticsValidation: {
    summary: ValidationChain[];
    breakdown: ValidationChain[];
    trends: ValidationChain[];
};
export declare const reportValidation: {
    generate: ValidationChain[];
};
export declare const messageValidation: {
    list: ValidationChain[];
    reclassify: ValidationChain[];
};
export declare const webhookValidation: {
    whatsapp: ValidationChain[];
    verify: ValidationChain[];
};
export declare const apiKeyValidation: {
    create: ValidationChain[];
    update: ValidationChain[];
};
export declare const paginationValidation: ValidationChain[];
declare const _default: {
    validate: typeof validate;
    handleValidationErrors: typeof handleValidationErrors;
    userValidation: {
        register: ValidationChain[];
        login: ValidationChain[];
        update: ValidationChain[];
        changePassword: ValidationChain[];
    };
    accountValidation: {
        create: ValidationChain[];
        update: ValidationChain[];
        getById: ValidationChain[];
    };
    analyticsValidation: {
        summary: ValidationChain[];
        breakdown: ValidationChain[];
        trends: ValidationChain[];
    };
    reportValidation: {
        generate: ValidationChain[];
    };
    messageValidation: {
        list: ValidationChain[];
        reclassify: ValidationChain[];
    };
    webhookValidation: {
        whatsapp: ValidationChain[];
        verify: ValidationChain[];
    };
    apiKeyValidation: {
        create: ValidationChain[];
        update: ValidationChain[];
    };
    paginationValidation: ValidationChain[];
};
export default _default;
//# sourceMappingURL=validator.d.ts.map